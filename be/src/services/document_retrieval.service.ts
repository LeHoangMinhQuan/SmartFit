/**
 * services/document_retrieval.service.ts
 *
 * Hybrid retrieval for the chatbot's search_knowledge_base tool
 * (rag-document-upload-plan.md §4.2 step 6 / §4.3). Close copy-adapt of
 * retrieval.service.ts's hybridSearch — same vector + keyword + RRF
 * fusion approach — but resolving to document_chunk rows instead of
 * product cards, and with no category/price/attribute filters (nothing
 * in §4's design calls for filtering documents the way product search
 * filters by category/price/attributes).
 *
 * IMPORTANT: both queries below join against `document` and require
 * status = 'indexed'. document_embedding.service.ts's embedAndStoreChunks
 * inserts chunk rows one at a time as each is embedded, and a document
 * only flips to status = 'indexed' after ALL of its chunks succeed — so
 * without this join condition, a document that's still mid-indexing
 * (status = 'processing') would already have some of its chunks visible
 * to search, silently returning an incomplete slice of that document as
 * if it were the whole thing. A 'failed' document should have zero
 * chunks anyway (embedAndStoreChunks rolls them back on failure), but
 * filtering by status here is a second, independent safeguard against
 * ever surfacing a chunk from a document that isn't in a known-complete
 * state — cheap to add, and the failure mode it prevents (confidently
 * wrong retrieval) is worse than the failure mode of over-filtering.
 */
import { embed } from "ai";
import type { GoogleGenerativeAIEmbeddingProviderOptions } from "@ai-sdk/google";
import db from "../config/db.js";
import { chatConfig, geminiProvider } from "../config/chat.js";
import { ApiError } from "../utils/ApiError.js";
import * as GeminiBudget from "./gemini-budget.service.js";

export interface DocumentSearchResult {
  chunk_id: number;
  document_id: number;
  document_title: string;
  content: string;
  chunk_index: number;
}

interface RankedChunkRow {
  chunk_id: number;
}

/**
 * Embeds a search query with taskType RETRIEVAL_QUERY — same asymmetric
 * query/document embedding reasoning as retrieval.service.ts's
 * embedQuery. Deliberately a separate function (not reused from
 * retrieval.service.ts) so this module's budget-failure messages can
 * reference the knowledge base rather than product search — the two
 * tools fail independently for the user-facing error text, even though
 * they share the exact same underlying Gemini budget/RPM accounting.
 */
async function embedQuery(query: string): Promise<number[]> {
  const model = chatConfig.embeddingModel;
  const reserved = await GeminiBudget.tryReserve(
    model,
    chatConfig.budgets.embedding,
    chatConfig.rpm.embedding,
  );
  if (!reserved.ok) {
    throw new ApiError(
      503,
      reserved.reason === "rpm"
        ? "Knowledge base search is handling a lot of requests right now."
        : "Knowledge base search has reached today's usage limit.",
    );
  }

  try {
    const { embedding } = await embed({
      model: geminiProvider.embeddingModel(model),
      value: query,
      providerOptions: {
        google: {
          outputDimensionality: chatConfig.embeddingDimensions,
          taskType: "RETRIEVAL_QUERY",
        } satisfies GoogleGenerativeAIEmbeddingProviderOptions,
      },
    });
    return embedding;
  } catch (err) {
    console.error(
      "[document_retrieval.service] embedQuery failed — refunding budget",
      { model, err },
    );
    await GeminiBudget.refund(reserved.reservation);
    throw err;
  }
}

async function vectorSearchChunks(
  query: string,
  k: number,
): Promise<RankedChunkRow[]> {
  const queryEmbedding = await embedQuery(query);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  return db("document_chunk as dc")
    .join("document as d", "dc.document_id", "d.document_id")
    .select("dc.chunk_id")
    .where("d.status", "indexed")
    .orderByRaw("dc.embedding <=> ?::vector", [vectorLiteral])
    .limit(k);
}

/**
 * Postgres full-text search over content_tsv — same websearch_to_tsquery
 * approach as retrieval.service.ts's keywordSearch (handles free-form
 * chat input without throwing on unescaped operator characters).
 */
async function keywordSearchChunks(
  query: string,
  k: number,
): Promise<RankedChunkRow[]> {
  return db("document_chunk as dc")
    .join("document as d", "dc.document_id", "d.document_id")
    .select("dc.chunk_id")
    .where("d.status", "indexed")
    .whereRaw("dc.content_tsv @@ websearch_to_tsquery('simple', ?)", [query])
    .orderByRaw(
      "ts_rank(dc.content_tsv, websearch_to_tsquery('simple', ?)) DESC",
      [query],
    )
    .limit(k);
}

/**
 * Runs vector + keyword search over document_chunk, fuses via the same
 * Reciprocal Rank Fusion formula as hybridSearch (score = Σ 1/(rrfK +
 * rank_i)), and resolves the top-k fused chunk_ids to their content +
 * source document title (for citing "Shipping Policy, section 2" —
 * chunk_index + document_title is what a chat response would use for
 * that, since there's no separate "section title" concept in v1's flat
 * fixed-size chunking).
 */
export async function documentSearch(
  query: string,
  k: number = chatConfig.retrieval.defaultK,
): Promise<DocumentSearchResult[]> {
  const poolSize = Math.max(k * 4, 20);

  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearchChunks(query, poolSize),
    keywordSearchChunks(query, poolSize),
  ]);

  const scores = new Map<number, number>();
  const addRanked = (results: RankedChunkRow[]) => {
    results.forEach((row, idx) => {
      const rank = idx + 1; // RRF ranks are 1-indexed
      const rrfScore = 1 / (chatConfig.retrieval.rrfK + rank);
      scores.set(row.chunk_id, (scores.get(row.chunk_id) ?? 0) + rrfScore);
    });
  };
  addRanked(vectorResults);
  addRanked(keywordResults);

  const rankedIds = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([chunk_id]) => chunk_id);

  if (!rankedIds.length) return [];

  // One query for all resolved chunks rather than N — chunk_id order is
  // re-applied afterward since a plain whereIn doesn't preserve it.
  const rows = await db("document_chunk as dc")
    .join("document as d", "dc.document_id", "d.document_id")
    .select(
      "dc.chunk_id",
      "dc.document_id",
      "dc.content",
      "dc.chunk_index",
      "d.title as document_title",
    )
    .whereIn("dc.chunk_id", rankedIds);

  const byId = new Map(rows.map((r) => [r.chunk_id, r]));
  return rankedIds
    .map((id) => byId.get(id))
    .filter((r): r is DocumentSearchResult => r !== undefined);
}
