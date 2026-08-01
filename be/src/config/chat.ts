/**
 * config/chat.ts
 *
 * Central config for the AI shopping assistant (chatbot build plan, Phase 2+).
 * Model names come from env (see .env.example) rather than being hardcoded,
 * so swapping gemini-2.5-flash-lite -> gemini-2.5-flash under rate-limit pressure
 * mid-demo is a one-line env var change, not a code change.
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
  chatModel: env.GEMINI_CHAT_MODEL,
  embeddingModel: env.GEMINI_EMBEDDING_MODEL,

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
