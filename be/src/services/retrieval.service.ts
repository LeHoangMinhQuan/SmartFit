/**
 * services/retrieval.service.ts
 *
 * Hybrid retrieval for the chatbot's search_products tool (Phase 4):
 * vector search (semantic) + keyword search (exact attribute/name match),
 * fused via Reciprocal Rank Fusion. See ecommerce-api-plan.md §11 for why
 * this needs to be hybrid rather than vector-only, given how short
 * product.name/description are.
 */
import type { Knex } from "knex";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import type { GoogleGenerativeAIEmbeddingProviderOptions } from "@ai-sdk/google";
import db from "../config/db.js";
import { chatConfig } from "../config/chat.js";
import * as ProductModel from "../models/product/product.model.js";

export interface SearchFilters {
  category_id?: number;
  max_price?: number;
}

export interface ProductCard {
  product_id: number;
  variant_id: number | null;
  name: string;
  price: number | null;
  image_url: string | null;
  url: string;
}

interface RankedRow {
  product_id: number;
}

/**
 * Embeds a search query with taskType RETRIEVAL_QUERY — deliberately NOT
 * RETRIEVAL_DOCUMENT (used for catalog ingestion, embedding.service.ts).
 * Gemini's embedding model produces asymmetric query/document vectors, so
 * using the wrong task type on either side measurably hurts retrieval
 * quality even though both still return a same-shaped vector.
 */
async function embedQuery(query: string): Promise<number[]> {
  console.log("[retrieval.service] embedQuery calling Gemini", {
    model: chatConfig.embeddingModel,
    query,
  });
  const startedAt = Date.now();
  const { embedding } = await embed({
    model: google.textEmbeddingModel(chatConfig.embeddingModel),
    value: query,
    providerOptions: {
      google: {
        outputDimensionality: chatConfig.embeddingDimensions,
        taskType: "RETRIEVAL_QUERY",
      } satisfies GoogleGenerativeAIEmbeddingProviderOptions,
    },
  });
  console.log("[retrieval.service] embedQuery resolved", {
    duration_ms: Date.now() - startedAt,
    dimensions: embedding.length,
  });
  return embedding;
}

/**
 * Applies category/price filters as correlated EXISTS subqueries against
 * pe.product_id, BEFORE ranking/limiting — filtering a top-k list after
 * the fact can silently return fewer than k results even when more exist.
 */
function applyFilters(
  qb: Knex.QueryBuilder,
  filters: SearchFilters | undefined,
): Knex.QueryBuilder {
  if (filters?.category_id !== undefined) {
    const category_id = filters.category_id;
    qb = qb.whereExists(function (this: Knex.QueryBuilder) {
      this.select(1)
        .from("product_category as pc")
        .whereRaw("pc.product_id = pe.product_id")
        .andWhere("pc.category_id", category_id);
    });
  }
  if (filters?.max_price !== undefined) {
    const max_price = filters.max_price;
    qb = qb.whereExists(function (this: Knex.QueryBuilder) {
      this.select(1)
        .from("product_price as pp")
        .whereRaw("pp.product_id = pe.product_id")
        .andWhere("pp.base_price", "<=", max_price);
    });
  }
  return qb;
}

/** Cosine-similarity ANN search over product_embedding via pgvector's HNSW index. */
export async function vectorSearch(
  query: string,
  k: number,
  filters?: SearchFilters,
): Promise<RankedRow[]> {
  const queryEmbedding = await embedQuery(query);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  let qb = db("product_embedding as pe")
    .select("pe.product_id")
    .orderByRaw("pe.embedding <=> ?::vector", [vectorLiteral])
    .limit(k);

  qb = applyFilters(qb, filters);

  return qb;
}

/**
 * Postgres full-text search over content_tsv, ranked by ts_rank.
 * Uses websearch_to_tsquery rather than the plan's literal to_tsquery —
 * to_tsquery throws on unescaped operator characters (&, |, !, ( ) that
 * show up routinely in free-form chat input; websearch_to_tsquery parses
 * natural free text the way a search box would and never errors on it.
 * Same underlying tsvector/ts_rank mechanism the plan calls for.
 */
export async function keywordSearch(
  query: string,
  k: number,
  filters?: SearchFilters,
): Promise<RankedRow[]> {
  let qb = db("product_embedding as pe")
    .select("pe.product_id")
    .whereRaw("pe.content_tsv @@ websearch_to_tsquery('simple', ?)", [query])
    .orderByRaw(
      "ts_rank(pe.content_tsv, websearch_to_tsquery('simple', ?)) DESC",
      [query],
    )
    .limit(k);

  qb = applyFilters(qb, filters);

  return qb;
}

/**
 * Resolves a product_id to a display-ready card: primary variant (first
 * in-stock, falling back to the first variant if none are in stock),
 * current price off that variant, primary product-level image, and a
 * frontend URL. Reuses ProductModel.findVariantsByProduct /
 * findImagesByProduct rather than a new query — same DEFAULT_STORE_ID
 * stock scoping already audited there.
 */
async function toProductCard(product_id: number): Promise<ProductCard | null> {
  const product = await ProductModel.findProductById(product_id);
  // A stale product_embedding row (product deleted after last reindex) —
  // skip rather than throw, since one bad row shouldn't fail the whole
  // search. POST /api/admin/chat/reindex is the fix, not a crash here.
  if (!product) return null;

  const [variants, images] = await Promise.all([
    ProductModel.findVariantsByProduct(product_id),
    ProductModel.findImagesByProduct(product_id),
  ]);

  const inStock = variants.find((v: { stock: number }) => Number(v.stock) > 0);
  const primaryVariant = inStock ?? variants[0] ?? null;

  return {
    product_id,
    variant_id: primaryVariant?.variant_id ?? null,
    name: product.name,
    price:
      primaryVariant?.base_price != null
        ? Number(primaryVariant.base_price)
        : null,
    image_url: images[0]?.s3_url ?? null,
    url: `/product/${product_id}`,
  };
}

/**
 * Runs vector + keyword search over a wider candidate pool than k, fuses
 * via Reciprocal Rank Fusion (score = Σ 1/(rrfK + rank_i), 1-indexed rank
 * per list), and resolves the top-k fused product_ids into display cards.
 */
export async function hybridSearch(
  query: string,
  filters?: SearchFilters,
  k: number = chatConfig.retrieval.defaultK,
): Promise<ProductCard[]> {
  console.log("[retrieval.service] hybridSearch called", { query, filters, k });
  const startedAt = Date.now();

  // Wider pool than k so RRF has enough signal to fuse over — narrowing
  // straight to k from each list separately would bias toward whichever
  // list happens to agree with a small top-k, not genuine hybrid ranking.
  const poolSize = Math.max(k * 4, 20);

  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(query, poolSize, filters),
    keywordSearch(query, poolSize, filters),
  ]);
  console.log("[retrieval.service] vector+keyword search resolved", {
    vector_count: vectorResults.length,
    keyword_count: keywordResults.length,
    duration_ms: Date.now() - startedAt,
  });

  const scores = new Map<number, number>();
  const addRanked = (results: RankedRow[]) => {
    results.forEach((row, idx) => {
      const rank = idx + 1; // RRF ranks are 1-indexed
      const rrfScore = 1 / (chatConfig.retrieval.rrfK + rank);
      scores.set(row.product_id, (scores.get(row.product_id) ?? 0) + rrfScore);
    });
  };
  addRanked(vectorResults);
  addRanked(keywordResults);

  const rankedIds = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([product_id]) => product_id);

  if (!rankedIds.length) {
    console.log("[retrieval.service] hybridSearch: no results after fusion");
    return [];
  }

  const cards = await Promise.all(rankedIds.map(toProductCard));
  const resolvedCards = cards.filter((c): c is ProductCard => c !== null);
  console.log("[retrieval.service] hybridSearch done", {
    card_count: resolvedCards.length,
    total_duration_ms: Date.now() - startedAt,
  });
  return resolvedCards;
}
