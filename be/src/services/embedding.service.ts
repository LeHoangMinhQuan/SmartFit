/**
 * services/embedding.service.ts
 *
 * Builds and stores the per-product embedding text used by the chatbot's
 * retrieval layer (Phase 3). See ecommerce-api-plan.md §11 for the design
 * rationale — one embedding row per product_id (not per variant), content
 * template, and the inline-on-write + bulk-reindex trigger strategy.
 */
import { embed } from "ai";
import type { GoogleGenerativeAIEmbeddingProviderOptions } from "@ai-sdk/google";
import db from "../config/db.js";
import { chatConfig, geminiProvider } from "../config/chat.js";
import { ApiError } from "../utils/ApiError.js";
import * as ProductModel from "../models/product/product.model.js";
import * as AttributeModel from "../models/attribute.model.js";
import * as PriceModel from "../models/product/product_price.model.js";
import * as GeminiBudget from "./gemini-budget.service.js";

/**
 * Builds the exact text that gets embedded for a product:
 *
 *   {name} — {description}
 *   Category: {comma-joined category names}
 *   Available options: {comma-joined distinct attribute values across all variants}
 *   Price: {min variant base_price}–{max variant base_price} VND
 *
 * Throws if the product doesn't exist — callers (upsertProductEmbedding,
 * reindexAll) only ever call this right after confirming a product_id is
 * real, so a missing product here signals a genuine bug, not a 404 case.
 */
export async function buildProductContent(product_id: number): Promise<string> {
  const [product, categories, options, prices] = await Promise.all([
    ProductModel.findProductById(product_id),
    ProductModel.findCategoriesByProduct(product_id),
    AttributeModel.findAttributeValuesByProduct(product_id),
    PriceModel.findPricesByProduct(product_id),
  ]);

  if (!product) {
    throw new Error(`buildProductContent: product ${product_id} not found`);
  }

  const categoryLine =
    categories.map((c: { name: string }) => c.name).join(", ") ||
    "Uncategorized";

  const optionsLine = options.length ? options.join(", ") : "N/A";

  let priceLine = "N/A";
  if (prices.length) {
    const values = prices.map((p: { base_price: string | number }) =>
      Number(p.base_price),
    );
    const min = Math.min(...values);
    const max = Math.max(...values);
    priceLine =
      min === max
        ? `${min.toLocaleString("vi-VN")} VND`
        : `${min.toLocaleString("vi-VN")}\u2013${max.toLocaleString("vi-VN")} VND`;
  }

  return [
    `${product.name} \u2014 ${product.description}`,
    `Category: ${categoryLine}`,
    `Available options: ${optionsLine}`,
    `Price: ${priceLine}`,
  ].join("\n");
}

/**
 * Embeds one product's content and upserts it into product_embedding.
 * Hooked into product.service.ts's create/update paths (product, variant,
 * attribute, category, price) so embeddings never go stale without a
 * background job. Also called directly by reindexAll for bulk backfill.
 */
export async function upsertProductEmbedding(
  product_id: number,
): Promise<void> {
  const content = await buildProductContent(product_id);
  const model = chatConfig.embeddingModel;

  // Same accounting as retrieval.service.ts's embedQuery — this call site
  // (product writes + admin bulk reindex) shares the SAME daily budget
  // and RPM ceiling as query-time embedding, since they're both hitting
  // the same Gemini embedding model/quota. A bulk reindex over a large
  // catalog is exactly the kind of burst that could otherwise blow
  // through the embedding model's RPM in seconds.
  const reserved = await GeminiBudget.tryReserve(
    model,
    chatConfig.budgets.embedding,
    chatConfig.rpm.embedding,
  );
  if (!reserved.ok) {
    throw new ApiError(
      503,
      reserved.reason === "rpm"
        ? `Embedding is being rate-limited right now — retry product ${product_id} shortly.`
        : `Today's embedding budget is exhausted — product ${product_id} was not (re)indexed. Try again after the daily reset.`,
    );
  }

  let embedding: number[];
  try {
    ({ embedding } = await embed({
      model: geminiProvider.embeddingModel(model),
      value: content,
      providerOptions: {
        google: {
          outputDimensionality: chatConfig.embeddingDimensions,
          taskType: "RETRIEVAL_DOCUMENT",
        } satisfies GoogleGenerativeAIEmbeddingProviderOptions,
      },
    }));
  } catch (err) {
    console.error(
      "[embedding.service] upsertProductEmbedding failed — refunding budget",
      { product_id, model, err },
    );
    await GeminiBudget.refund(reserved.reservation);
    throw err;
  }

  // pgvector accepts a bracketed literal string cast to ::vector — knex has
  // no native vector type binding, so this stays a raw query.
  const vectorLiteral = `[${embedding.join(",")}]`;

  await db.raw(
    `
    INSERT INTO product_embedding (product_id, content, embedding, updated_at)
    VALUES (?, ?, ?::vector, NOW())
    ON CONFLICT (product_id) DO UPDATE
      SET content    = EXCLUDED.content,
          embedding  = EXCLUDED.embedding,
          updated_at = NOW()
    `,
    [product_id, content, vectorLiteral],
  );
}

/**
 * Re-embeds every product in the catalog. Needed once at bootstrap and
 * after any manual DB edits/seed script runs. Sequential, not parallelized
 * — catalog is thesis-scale, and staying well under embedding RPM matters
 * more here than shaving seconds off a reindex that runs rarely.
 */
export async function reindexAll(): Promise<{
  reindexed_count: number;
  skipped_count: number;
  stopped_early: boolean;
}> {
  const productIds = await ProductModel.findAllProductIds();

  let reindexed_count = 0;
  let skipped_count = 0;

  for (const product_id of productIds) {
    try {
      await upsertProductEmbedding(product_id);
      reindexed_count++;
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 503) {
        // RPM stalls clear within a minute — wait it out and keep going
        // rather than aborting a bulk job over a transient 60s window.
        // A real daily-budget exhaustion won't clear until tomorrow, so
        // there's no point burning through the rest of the catalog
        // retrying that one — stop and report what was actually done.
        if (err.message.includes("rate-limited")) {
          console.warn(
            "[embedding.service] reindexAll: RPM stall, waiting 60s",
            { product_id },
          );
          await new Promise((resolve) => setTimeout(resolve, 60_000));
          try {
            await upsertProductEmbedding(product_id);
            reindexed_count++;
            continue;
          } catch (retryErr) {
            console.error(
              "[embedding.service] reindexAll: retry after RPM stall also failed, stopping",
              { product_id, retryErr },
            );
          }
        }
        skipped_count = productIds.length - reindexed_count;
        console.error(
          "[embedding.service] reindexAll: stopping early — embedding budget exhausted",
          { reindexed_count, skipped_count, stoppedAt: product_id },
        );
        return { reindexed_count, skipped_count, stopped_early: true };
      }
      throw err;
    }
  }

  return { reindexed_count, skipped_count, stopped_early: false };
}
