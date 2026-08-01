/**
 * config/chat.ts
 *
 * Central config for the AI shopping assistant (chatbot build plan, Phase 2+).
 * Model names come from env (see .env.example) rather than being hardcoded.
 * As of 2026-08-01, chat.service.ts no longer picks a single fixed model —
 * services/model-router.service.ts routes each turn between the "heavy"
 * (chatModel) and "light" (liteModel) models below based on task
 * complexity and remaining daily free-tier budget. Both names still live
 * here in env rather than hardcoded, so a further model swap stays a
 * one-line env var change, not a code change.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "./env.js";

/**
 * A configured Google provider instance — NOT the default `google` export
 * from @ai-sdk/google. That default singleton only ever reads
 * `process.env.GOOGLE_GENERATIVE_AI_API_KEY`; it has no way to know about
 * our custom `GEMINI_API_KEY` env var name. Importing bare `google`
 * anywhere in this codebase throws `LoadAPIKeyError` at call time
 * regardless of whether a real GEMINI_API_KEY is set — this was a real
 * production bug, not a config issue on the deploy side. Both
 * chat.service.ts and retrieval.service.ts must import THIS, not
 * `{ google }` from "@ai-sdk/google" directly.
 */
export const geminiProvider = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY,
});

export const chatConfig = {
  // "Heavy" model — see services/model-router.service.ts. Kept as
  // `chatModel` (not renamed) since chat.service.ts's existing log lines
  // and comments already reference it under this name.
  chatModel: env.GEMINI_CHAT_MODEL,
  // "Light" model — cheap/fast fallback + default for simple turns.
  liteModel: env.GEMINI_CHAT_MODEL_LITE,
  embeddingModel: env.GEMINI_EMBEDDING_MODEL,

  // Daily free-tier request budgets per model, enforced by
  // model-router.service.ts / gemini-budget.service.ts via the
  // gemini_usage_counter table. See the env var comments in
  // config/env.ts for why these are conservative rather than an exact
  // quota mirror.
  budgets: {
    heavy: env.GEMINI_HEAVY_DAILY_BUDGET,
    lite: env.GEMINI_LITE_DAILY_BUDGET,
    embedding: env.GEMINI_EMBEDDING_DAILY_BUDGET,
  },

  // Requests-per-minute ceilings, enforced in-process (see
  // services/rpm-limiter.service.ts) ahead of every Gemini call. See the
  // env var comments in config/env.ts for the full rationale — this is
  // an app-wide cap shared across all users, not a per-user throttle.
  rpm: {
    heavy: env.GEMINI_HEAVY_RPM,
    lite: env.GEMINI_LITE_RPM,
    embedding: env.GEMINI_EMBEDDING_RPM,
  },

  // Matryoshka Representation Learning truncation — matches the vector(768)
  // column width in product_embedding. Must stay in sync with the schema.
  embeddingDimensions: 768,

  // Hybrid retrieval (Phase 3)
  retrieval: {
    defaultK: 5,
    // Reciprocal Rank Fusion constant — standard default per the IR
    // literature (Cormack et al.), also cited in ecommerce-api-plan.md §11.
    rrfK: 60,
  },

  // How many past chat_message rows to load as conversation history
  // (Phase 4). 20 rows ≈ 10 user/assistant turns — enough for the model to
  // resolve "the first one" / "that jacket" style references without
  // ballooning the prompt on a long-running session.
  historyLimit: 20,
};
