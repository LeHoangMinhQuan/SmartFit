/**
 * scripts/check-gemini.ts
 *
 * Phase 0 acceptance check for the chatbot build plan: confirms GEMINI_API_KEY
 * in .env is valid and gemini-2.5-pro is reachable for this key.
 *
 * Run with: npm run check:gemini
 */
import { config } from "dotenv";
config();

import { generateText } from "ai";
import { google } from "@ai-sdk/google";

const model = process.env["GEMINI_CHAT_MODEL"] ?? "gemini-2.5-pro";

async function main() {
  if (!process.env["GEMINI_API_KEY"]) {
    console.error("[check-gemini] GEMINI_API_KEY is not set in .env");
    process.exit(1);
  }

  console.log(`[check-gemini] calling ${model}...`);

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
