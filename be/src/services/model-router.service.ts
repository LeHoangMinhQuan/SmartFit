/**
 * services/model-router.service.ts
 *
 * Routes each chat turn to one of two Gemini models based on (1) how
 * complex the turn looks and (2) how much of today's free-tier budget is
 * left for each model. Added 2026-08-01 alongside the gemini-2.5 →
 * gemini-3.6/3.1 migration (see CHATBOT_BUILD_PLAN.md's model note) —
 * once two models were in play anyway, routing between them by task
 * weight gets more mileage out of the same free-tier ceiling instead of
 * spending "heavy" model budget on messages that didn't need it.
 *
 * Classification is a zero-cost heuristic (regex/length checks), not an
 * LLM call — an LLM-based classifier would itself burn free-tier budget
 * on every single turn just to decide which model to use for that turn,
 * which works against the entire point of this router. It won't be
 * perfect; see classifyComplexity's doc comment for the specific signals
 * and their rationale.
 */
import { ApiError } from "../utils/ApiError.js";
import { chatConfig } from "../config/chat.js";
import * as GeminiBudget from "./gemini-budget.service.js";
import type { ReserveFailureReason } from "./gemini-budget.service.js";
import type { ChatMessageRow } from "../models/chat-session.model.js";

export type ChatComplexity = "light" | "heavy";

export interface ModelSelection {
  model: string;
  /** What the heuristic actually asked for, before any budget fallback. */
  requestedComplexity: ChatComplexity;
  /** The tier actually used, after budget fallback. */
  usedComplexity: ChatComplexity;
  /** True if budget pressure forced a different tier than requested. */
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
 * Decides which model this turn actually calls, applying budget-aware
 * fallback on top of classifyComplexity's request:
 *   - heavy request, heavy budget available  -> heavy
 *   - heavy request, heavy exhausted         -> lite (downgrade)
 *   - light request, lite budget available   -> lite
 *   - light request, lite exhausted          -> heavy (upgrade — heavy can
 *     always handle a light task, it's just costlier, so this is a better
 *     failure mode than refusing a simple request while heavy budget
 *     still exists)
 *   - both exhausted                         -> throws ApiError(503)
 *
 * Reserves gemini_usage_counter budget (and an RPM slot) for whichever
 * model is actually chosen via GeminiBudget.tryReserve — a single atomic
 * operation, not a separate check-then-write, so two simultaneous
 * requests landing on the last unit of budget can't both succeed (see
 * model-usage.model.ts's tryIncrement doc comment).
 *
 * The returned selection carries a `reservation` — if the actual Gemini
 * call this was reserved for ends up failing, the caller MUST call
 * GeminiBudget.refund(selection.reservation) so that failed call doesn't
 * permanently count against today's budget.
 */
export async function selectModel(
  message: string,
  history: ChatMessageRow[],
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

  const primary =
    requestedComplexity === "heavy"
      ? await tryUse(heavyModel, "heavy", budgets.heavy, rpm.heavy)
      : await tryUse(liteModel, "light", budgets.lite, rpm.lite);
  if (typeof primary !== "string") {
    console.log("[model-router] selected", primary);
    return primary;
  }

  // Primary tier's budget/RPM is gone — fall back to the other tier.
  const fallback =
    requestedComplexity === "heavy"
      ? await tryUse(liteModel, "light", budgets.lite, rpm.lite)
      : await tryUse(heavyModel, "heavy", budgets.heavy, rpm.heavy);
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

  // If EITHER tier failed only on RPM (a rolling 60s window that clears
  // itself), this is transient and worth telling the customer to just
  // wait a moment. Only if BOTH failed on the daily budget is this a
  // real "come back tomorrow" situation (RPD quotas reset at midnight
  // Pacific — see config/env.ts's GEMINI_*_RPM comment).
  const bothDailyExhausted =
    primary === "daily_budget" && fallback === "daily_budget";

  throw new ApiError(
    503,
    bothDailyExhausted
      ? "The shopping assistant has reached today's free usage limit. Please try again later."
      : "The shopping assistant is handling a lot of requests right now. Please try again in a minute.",
  );
}
