import app from "./app.js";
import { env } from "./config/env.js";
import { expireStalePendingOrders } from "./services/order.service.js";
import db from "./config/db.js";

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

// DEBUG / startup guard: verify product_embedding actually has a row for
// every active product. Root cause this catches: seeds/06_demo_products.ts
// (and any other direct `knex('product').insert(...)` path) writes straight
// to the `product` table, bypassing product.service.ts's create hook that
// normally calls EmbeddingService.upsertProductEmbedding(). `npm run seed`
// has no reindex step after it either. Net effect: product_embedding can be
// completely (or partially) empty after a fresh seed, and hybridSearch's
// vector+keyword search both join against product_embedding — so EVERY
// search_products call returns 0 results, for EVERY query, regardless of
// what the customer asked or how the LLM phrased the search. This is
// indistinguishable from a live outage in the chat UI ("No matching
// products found" on everything) unless you know to check this table.
// Fix when this fires: POST /api/admin/chat/reindex (EmbeddingService.reindexAll).
async function checkEmbeddingCoverage(): Promise<void> {
  try {
    const productResult = await db("product")
      .where({ is_active: true })
      .count<{ count: string }[]>("* as count");
    const productCount = productResult[0]?.count ?? '0';

    const embeddingResult = await db("product_embedding").count<{
      count: string;
    }[]>("* as count");
    const embeddingCount = embeddingResult[0]?.count ?? '0';

    const products = Number(productCount);
    const embeddings = Number(embeddingCount);
    console.log("[server] product_embedding coverage check", {
      active_products: products,
      embedding_rows: embeddings,
    });
    if (products > 0 && embeddings === 0) {
      console.warn(
        `[server] WARNING: product_embedding is EMPTY but ${products} active product(s) exist. ` +
          "search_products will return 0 results for every query until you run POST /api/admin/chat/reindex.",
      );
    } else if (embeddings < products) {
      console.warn(
        `[server] WARNING: product_embedding has ${embeddings} row(s) but there are ${products} active products — ` +
          "some products won't be findable via chat search until POST /api/admin/chat/reindex is run.",
      );
    }
  } catch (err) {
    console.error("[server] product_embedding coverage check failed:", err);
  }
}
void checkEmbeddingCoverage();

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
