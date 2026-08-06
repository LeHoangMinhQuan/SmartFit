/**
 * services/model-router.service.ts
 *
 * Routes each chat turn to one of two Gemini models based on (1) how
 * complex the turn looks, (2) how much of today's free-tier budget is
 * left for each model, and (3) how much of the HEAVY model's tiny daily
 * budget this specific user has already used today.
 *
 * Classification is a zero-cost heuristic (regex/length checks), not an
 * LLM call — see classifyComplexity's doc comment for the specific
 * signals and their rationale.
 *
 * UPDATE (per-user heavy cap): heavy is a few RPD, shared across every
 * user of the app (see config/env.ts). chatLimiter
 * (middleware/rateLimiter.ts, 15 msgs/10min/user) throttles raw message
 * volume but has no concept of which messages are heavy-classified — a
 * single user sending cart/comparison-intent turns could otherwise
 * consume most of the day's global heavy budget alone. selectModel now
 * takes a userId and checks models/user-heavy-usage.model.ts's per-user
 * daily cap BEFORE taking a slot from the global heavy pool, so no
 * global reservation is wasted on a request that's about to be denied
 * anyway.
 *
 * UPDATE (fallback removed): the previous "light request, lite exhausted
 * -> upgrade to heavy" fallback has been removed. With heavy's daily
 * budget an order of magnitude smaller than lite's, lite exhaustion is a
 * real-load signal, not a fluke — letting ordinary searches overflow
 * into the heavy pool would defeat the per-user heavy cap above and
 * starve genuine cart/comparison-intent turns of the budget they need
 * most. The reverse fallback (heavy request, heavy exhausted -> downgrade
 * to lite) is UNCHANGED — heavy can always handle a light-shaped task at
 * worst quality cost, so downgrading beats refusing while lite budget
 * still exists.
 *
 * UPDATE (reason codes): every ApiError(503) thrown here now carries a
 * `code` of either "rpm_transient" (an RPM window is saturated — clears
 * in ~60s on its own) or "daily_exhausted" (today's daily budget is
 * genuinely spent). Added because the frontend (ChatPanel.tsx) branches
 * on statusCode alone today and shows a flat "come back later" banner
 * for every 503 — with the light-upgrade fallback removed, an ordinary
 * RPM hiccup on the (much more common) light path now surfaces as a 503
 * too, and deserves the same short-wait UI treatment a 429 gets, not the
 * "come back tomorrow" one. See ChatPanel.tsx for the matching branch.
 */
import { ApiError } from "../utils/ApiError.js";
import { chatConfig } from "../config/chat.js";
import * as GeminiBudget from "./gemini-budget.service.js";
import type { ReserveFailureReason } from "./gemini-budget.service.js";
import * as UserHeavyUsage from "../models/user-heavy-usage.model.js";
import type { ChatMessageRow } from "../models/chat-session.model.js";

export type ChatComplexity = "light" | "heavy";

// Sized against the global heavy daily budget (config/env.ts,
// GEMINI_HEAVY_DAILY_BUDGET) for a ~10-user demo — a few requests per
// user leaves slack for whoever's actively testing without letting one
// person eat the whole daily pool alone. Revisit if the real user count
// or the free-tier heavy RPD changes.
const HEAVY_PER_USER_DAILY_CAP = 3;

export interface ModelSelection {
  model: string;
  /** What the heuristic actually asked for, before any budget fallback. */
  requestedComplexity: ChatComplexity;
  /** The tier actually used, after budget fallback. */
  usedComplexity: ChatComplexity;
  /** True if budget pressure (global OR per-user) forced a different tier than requested. */
  degraded: boolean;
  /** Pass to GeminiBudget.refund() if the actual Gemini call fails. */
  reservation: GeminiBudget.BudgetReservation;
}

// Cart/purchase-intent — getting the (product_id, variant_id) pair right
// matters more here (a wrong add is a worse mistake than a slightly-off
// search), so route these to the stronger model even though the message
// itself may be short.
const CART_INTENT_RE = /\b(add|buy|purchase|order|checkout|cart)\b/i;

// Comparison/recommendation/advice — genuinely needs more reasoning than
// "filter the catalog by these facets".
const REASONING_RE =
  /\b(compare|comparison|vs\.?|versus|recommend|suggest|which (one|is)|better|best for|difference between)\b/i;

// Anaphoric references ("it", "that one", "the first one") only make a
// turn heavy if there's actually prior history to resolve them against —
// the same words in a fresh session have nothing to refer to.
const CONTEXT_REF_RE =
  /\b(it|that one|this one|the first one|those|the same one|earlier|previous)\b/i;

// Turns with a lot of accumulated history benefit from the stronger
// model's larger effective context handling, even if this specific
// message reads as simple in isolation.
const LONG_HISTORY_TURNS = 6; // messages, not user/assistant pairs
const LONG_MESSAGE_WORDS = 40;

/**
 * Heuristic-only classification — see the module doc comment for why this
 * isn't an LLM call. Signals, any one of which makes a turn "heavy":
 *   - Cart/purchase intent (CART_INTENT_RE)
 *   - Comparison/recommendation/advice language (REASONING_RE)
 *   - An anaphoric reference AND non-empty history to resolve it against
 *     (CONTEXT_REF_RE + history.length > 0)
 *   - A long message (LONG_MESSAGE_WORDS) — more likely a compound/
 *     multi-part ask than a single filter query
 *   - A long-running conversation (LONG_HISTORY_TURNS) — more context to
 *     integrate regardless of what this specific message says
 * Everything else — most single-intent catalog searches/filters,
 * greetings, yes/no answers — classifies as "light".
 */
export function classifyComplexity(
  message: string,
  history: ChatMessageRow[],
): ChatComplexity {
  if (CART_INTENT_RE.test(message)) return "heavy";
  if (REASONING_RE.test(message)) return "heavy";
  if (history.length > 0 && CONTEXT_REF_RE.test(message)) return "heavy";
  if (message.trim().split(/\s+/).length > LONG_MESSAGE_WORDS) return "heavy";
  if (history.length > LONG_HISTORY_TURNS) return "heavy";
  return "light";
}

/**
 * Decides which model this turn actually calls:
 *   - heavy request, user under their per-user cap, heavy budget
 *     available                              -> heavy
 *   - heavy request, user AT their per-user cap for today
 *     (global heavy budget not even attempted) -> lite (downgrade)
 *   - heavy request, under cap but heavy budget exhausted -> lite (downgrade)
 *   - light request, lite budget available   -> lite
 *   - light request, lite exhausted          -> throws ApiError(503)
 *     (NO upgrade to heavy — see module doc comment)
 *   - heavy requested, allowed, but BOTH the heavy attempt and the lite
 *     fallback are exhausted                 -> throws ApiError(503)
 *
 * Reserves gemini_usage_counter budget (and an RPM slot) for whichever
 * model is actually chosen via GeminiBudget.tryReserve — a single atomic
 * operation (see model-usage.model.ts's tryIncrement doc comment). The
 * per-user heavy cap check (UserHeavyUsage.tryIncrement) is the same
 * atomic pattern, checked first so a user at cap never takes a global
 * heavy slot they're about to be denied anyway.
 *
 * The returned selection carries a `reservation` — if the actual Gemini
 * call this was reserved for ends up failing, the caller MUST call
 * GeminiBudget.refund(selection.reservation) AND, if
 * selection.usedComplexity === "heavy", UserHeavyUsage.decrement(userId)
 * — so a failed call doesn't permanently count against either budget.
 */
export async function selectModel(
  message: string,
  history: ChatMessageRow[],
  userId: number,
): Promise<ModelSelection> {
  const requestedComplexity = classifyComplexity(message, history);
  const { chatModel: heavyModel, liteModel, budgets, rpm } = chatConfig;

  const tryUse = async (
    model: string,
    tier: ChatComplexity,
    budget: number,
    rpmLimit: number,
  ): Promise<ModelSelection | ReserveFailureReason> => {
    const result = await GeminiBudget.tryReserve(model, budget, rpmLimit);
    if (!result.ok) return result.reason;
    return {
      model,
      requestedComplexity,
      usedComplexity: tier,
      degraded: tier !== requestedComplexity,
      reservation: result.reservation,
    };
  };

  // Per-user heavy cap — checked before touching the global heavy pool.
  // A user already at cap is treated exactly like "global heavy budget
  // exhausted" from here on: this turn is attempted on lite instead.
  let heavyAllowedForUser = true;
  if (requestedComplexity === "heavy") {
    const userCount = await UserHeavyUsage.tryIncrement(
      userId,
      HEAVY_PER_USER_DAILY_CAP,
    );
    heavyAllowedForUser = userCount !== null;
    if (!heavyAllowedForUser) {
      console.warn("[model-router] per-user heavy cap reached", {
        userId,
        cap: HEAVY_PER_USER_DAILY_CAP,
      });
    }
  }

  const primary =
    requestedComplexity === "heavy" && heavyAllowedForUser
      ? await tryUse(heavyModel, "heavy", budgets.heavy, rpm.heavy)
      : await tryUse(liteModel, "light", budgets.lite, rpm.lite);
  if (typeof primary !== "string") {
    console.log("[model-router] selected", primary);
    return primary;
  }

  // Only one fallback direction remains: a heavy request whose actual
  // global heavy attempt failed (RPM or daily budget) falls back to
  // lite. A light request (or a heavy request denied by the per-user cap
  // and then failing on lite) has nowhere left to fall back to.
  if (requestedComplexity === "heavy" && heavyAllowedForUser) {
    const fallback = await tryUse(liteModel, "light", budgets.lite, rpm.lite);
    if (typeof fallback !== "string") {
      console.warn("[model-router] budget fallback engaged", fallback);
      return fallback;
    }

    console.error("[model-router] both models exhausted for today", {
      heavyModel,
      liteModel,
      primaryReason: primary,
      fallbackReason: fallback,
    });

    const bothDailyExhausted =
      primary === "daily_budget" && fallback === "daily_budget";

    throw new ApiError(
      503,
      bothDailyExhausted
        ? "The shopping assistant has reached today's free usage limit. Please try again later."
        : "The shopping assistant is handling a lot of requests right now. Please try again in a minute.",
      undefined,
      bothDailyExhausted ? "daily_exhausted" : "rpm_transient",
    );
  }

  // Light request (or per-user-capped heavy request) failed on lite,
  // with no upgrade path. RPM windows self-clear in ~60s; daily
  // exhaustion means genuinely come back later.
  console.warn("[model-router] lite exhausted, no fallback available", {
    liteModel,
    reason: primary,
    requestedComplexity,
    heavyAllowedForUser,
  });

  const dailyExhausted = primary === "daily_budget";

  throw new ApiError(
    503,
    dailyExhausted
      ? "The shopping assistant has reached today's free usage limit. Please try again later."
      : "The shopping assistant is handling a lot of requests right now. Please try again in a minute.",
    undefined,
    dailyExhausted ? "daily_exhausted" : "rpm_transient",
  );
}
