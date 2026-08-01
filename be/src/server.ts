import app from "./app.js";
import { env } from "./config/env.js";
import { expireStalePendingOrders } from "./services/order.service.js";

// Start the server
const port: number = env.PORT ?? 3000;

app.listen(port, "0.0.0.0", (error?: Error) => {
  if (error) {
    throw error;
  }

  console.log(`Server running on port ${port}`);
  // DEBUG: confirms what this running process actually resolved, in case
  // the deployed .env is stale/different from what you expect.
  console.log("[server] Gemini config:", {
    chat_model_heavy: env.GEMINI_CHAT_MODEL,
    chat_model_lite: env.GEMINI_CHAT_MODEL_LITE,
    embedding_model: env.GEMINI_EMBEDDING_MODEL,
    heavy_daily_budget: env.GEMINI_HEAVY_DAILY_BUDGET,
    lite_daily_budget: env.GEMINI_LITE_DAILY_BUDGET,
    embedding_daily_budget: env.GEMINI_EMBEDDING_DAILY_BUDGET,
    heavy_rpm: env.GEMINI_HEAVY_RPM,
    lite_rpm: env.GEMINI_LITE_RPM,
    embedding_rpm: env.GEMINI_EMBEDDING_RPM,
    api_key_present: Boolean(env.GEMINI_API_KEY),
    api_key_preview: env.GEMINI_API_KEY
      ? `${env.GEMINI_API_KEY.slice(0, 6)}...${env.GEMINI_API_KEY.slice(-4)}`
      : null,
  });

  // Zero here means every reservation attempt for that model will be
  // rejected before the request ever reaches Gemini — 100% failure rate,
  // not intermittent. This is exactly the mechanism behind the "chatbot
  // always says no products found" bug: GEMINI_EMBEDDING_DAILY_BUDGET or
  // GEMINI_EMBEDDING_RPM landing on 0 (usually from a present-but-blank
  // env var — see env.ts's envNumber() comment) means every
  // search_products call's embedding request gets rejected by
  // gemini-budget.service.ts before ever calling Google, so search
  // always comes back empty regardless of the catalog/query.
  const zeroValueChecks: Array<[string, number]> = [
    ["GEMINI_HEAVY_DAILY_BUDGET", env.GEMINI_HEAVY_DAILY_BUDGET],
    ["GEMINI_LITE_DAILY_BUDGET", env.GEMINI_LITE_DAILY_BUDGET],
    ["GEMINI_EMBEDDING_DAILY_BUDGET", env.GEMINI_EMBEDDING_DAILY_BUDGET],
    ["GEMINI_HEAVY_RPM", env.GEMINI_HEAVY_RPM],
    ["GEMINI_LITE_RPM", env.GEMINI_LITE_RPM],
    ["GEMINI_EMBEDDING_RPM", env.GEMINI_EMBEDDING_RPM],
  ];
  for (const [name, value] of zeroValueChecks) {
    if (value === 0) {
      console.warn(
        `[server] WARNING: ${name} resolved to 0 — every Gemini call gated on this budget/RPM will be rejected, 100% of the time, not intermittently. Check for a present-but-blank ${name}= line in your deployed env.`,
      );
    }
  }
});

// Sweep abandoned 'pending_payment' orders (cancel + restore stock) every
// 5 minutes, independent of whether anyone views their orders in the
// meantime. Also run once shortly after boot to catch anything left over
// from before the server restarted. See order.service.ts for details.
const STALE_ORDER_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function runStaleOrderSweep(): void {
  expireStalePendingOrders().catch((err) => {
    console.error("[stale-order-sweep] failed:", err);
  });
}

setTimeout(runStaleOrderSweep, 10_000);
setInterval(runStaleOrderSweep, STALE_ORDER_SWEEP_INTERVAL_MS);
