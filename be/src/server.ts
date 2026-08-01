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
    chat_model: env.GEMINI_CHAT_MODEL,
    embedding_model: env.GEMINI_EMBEDDING_MODEL,
    api_key_present: Boolean(env.GEMINI_API_KEY),
    api_key_preview: env.GEMINI_API_KEY
      ? `${env.GEMINI_API_KEY.slice(0, 6)}...${env.GEMINI_API_KEY.slice(-4)}`
      : null,
  });
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
