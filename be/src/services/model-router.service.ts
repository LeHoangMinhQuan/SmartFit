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
import * as ModelUsageModel from "../models/model-usage.model.js";
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
 * Increments gemini_usage_counter for whichever model is actually chosen.
 * Check-then-increment (not a single atomic decision query) — see
 * model-usage.model.ts's doc comment for the accepted race-window
 * trade-off at this project's traffic scale.
 */
export async function selectModel(
  message: string,
  history: ChatMessageRow[],
): Promise<ModelSelection> {
  const requestedComplexity = classifyComplexity(message, history);
  const { chatModel: heavyModel, liteModel, budgets } = chatConfig;

  const tryUse = async (
    model: string,
    tier: ChatComplexity,
    budget: number,
  ): Promise<ModelSelection | null> => {
    const count = await ModelUsageModel.getTodayCount(model);
    if (count >= budget) return null;
    await ModelUsageModel.incrementAndGetCount(model);
    return {
      model,
      requestedComplexity,
      usedComplexity: tier,
      degraded: tier !== requestedComplexity,
    };
  };

  const primary =
    requestedComplexity === "heavy"
      ? await tryUse(heavyModel, "heavy", budgets.heavy)
      : await tryUse(liteModel, "light", budgets.lite);
  if (primary) {
    console.log("[model-router] selected", primary);
    return primary;
  }

  // Primary tier's budget is gone — fall back to the other tier.
  const fallback =
    requestedComplexity === "heavy"
      ? await tryUse(liteModel, "light", budgets.lite)
      : await tryUse(heavyModel, "heavy", budgets.heavy);
  if (fallback) {
    console.warn("[model-router] budget fallback engaged", fallback);
    return fallback;
  }

  console.error("[model-router] both models exhausted for today", {
    heavyModel,
    liteModel,
  });
  throw new ApiError(
    503,
    "The shopping assistant has reached today's free usage limit. Please try again later.",
  );
}
