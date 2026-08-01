/**
 * scripts/check-gemini.ts
 *
 * Phase 0 acceptance check for the chatbot build plan: confirms GEMINI_API_KEY
 * in .env is valid and gemini-2.5-flash-lite is reachable for this key.
 *
 * Run with: npm run check:gemini
 */
import { config } from "dotenv";
config();

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const model = process.env["GEMINI_CHAT_MODEL"] || "gemini-2.5-flash-lite";

async function main() {
  if (!process.env["GEMINI_API_KEY"]) {
    console.error("[check-gemini] GEMINI_API_KEY is not set in .env");
    process.exit(1);
  }

  console.log(`[check-gemini] calling ${model}...`);

  // NOT the bare `google` import — that singleton only ever reads
  // process.env.GOOGLE_GENERATIVE_AI_API_KEY, not our custom
  // GEMINI_API_KEY name, and throws LoadAPIKeyError regardless of a real
  // key being present. This exact mistake shipped to production once
  // already (see CHATBOT_BUILD_PLAN.md Phase 4 debugging notes) — this
  // script exists specifically to catch it before that happens again.
  const google = createGoogleGenerativeAI({
    apiKey: process.env["GEMINI_API_KEY"],
  });

  const { text } = await generateText({
    model: google(model),
    prompt: "Reply with exactly one word: hello",
  });

  console.log(`[check-gemini] response: ${text}`);
  console.log("[check-gemini] OK — key works, model is reachable.");
}

main().catch((err) => {
  console.error("[check-gemini] FAILED:", err);
  process.exit(1);
});
