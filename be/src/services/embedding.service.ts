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
import * as ProductModel from "../models/product/product.model.js";
import * as AttributeModel from "../models/attribute.model.js";
import * as PriceModel from "../models/product/product_price.model.js";

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

  const { embedding } = await embed({
    model: geminiProvider.textEmbeddingModel(chatConfig.embeddingModel),
    value: content,
    providerOptions: {
      google: {
        outputDimensionality: chatConfig.embeddingDimensions,
        taskType: "RETRIEVAL_DOCUMENT",
      } satisfies GoogleGenerativeAIEmbeddingProviderOptions,
    },
  });

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
export async function reindexAll(): Promise<{ reindexed_count: number }> {
  const productIds = await ProductModel.findAllProductIds();

  let reindexed_count = 0;
  for (const product_id of productIds) {
    await upsertProductEmbedding(product_id);
    reindexed_count++;
  }

  return { reindexed_count };
}
