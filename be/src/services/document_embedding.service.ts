/**
 * services/document_embedding.service.ts
 *
 * Embeds and stores a document's chunks (rag-document-upload-plan.md
 * §4.2 step 5). Takes chunks that document_chunking.service.ts already
 * produced — this module only does the embed-and-persist half of the
 * pipeline, not extraction or chunking themselves.
 *
 * Shares the exact same GeminiBudget accounting as embedding.service.ts's
 * upsertProductEmbedding (same model, same daily budget, same RPM
 * ceiling — they're the same Gemini quota), and the same
 * stall-60s/retry-once/else-stop pattern as reindexAll(). One important
 * difference from reindexAll, though: reindexAll's unit of work is one
 * PRODUCT, and products are independent of each other, so skipping a
 * failed one and moving on to the next is fine. Here the unit of work is
 * one CHUNK, and all of a document's chunks belong to the SAME document —
 * a document with only half its chunks embedded isn't "half indexed", it's
 * silently incomplete for retrieval (documentSearch() would return
 * confident-looking partial results with no signal anything is missing).
 * So instead of reindexAll's skip-and-continue, this is all-or-nothing per
 * document: on any unrecoverable failure, whatever chunks already got
 * inserted for this document are deleted again before returning, so a
 * document is only ever left in `indexed` (complete) or `failed` (zero
 * chunks) — never a silent partial state in between.
 */
import { embed } from "ai";
import type { GoogleGenerativeAIEmbeddingProviderOptions } from "@ai-sdk/google";
import db from "../config/db.js";
import { chatConfig, geminiProvider } from "../config/chat.js";
import { ApiError } from "../utils/ApiError.js";
import * as GeminiBudget from "./gemini-budget.service.js";
import type { DocumentChunk } from "./document_chunking.service.js";

export interface EmbedResult {
  indexed_count: number;
  total_count: number;
  stopped_early: boolean;
}

/**
 * Embeds every chunk for `document_id` and inserts them into
 * document_chunk, then sets document.status to 'indexed' or 'failed'
 * accordingly — the caller (the upload route, once step 9 exists) does
 * not need to separately manage document.status after calling this; it
 * always lands in a definitive terminal state.
 *
 * Assumes document_id already exists with status = 'processing' (set at
 * upload time, before extraction/chunking even ran) and has no existing
 * document_chunk rows — this is only ever called once per fresh upload
 * or once per manual reindex-of-a-failed-document, never to incrementally
 * add chunks to an already-indexed document (plan §5: "no re-chunking...
 * updating a document means delete + re-upload").
 */
export async function embedAndStoreChunks(
  document_id: number,
  chunks: DocumentChunk[],
): Promise<EmbedResult> {
  const model = chatConfig.embeddingModel;
  const total_count = chunks.length;
  let indexed_count = 0;

  for (const chunk of chunks) {
    const ok = await embedAndInsertOneChunk(document_id, chunk, model);
    if (ok) {
      indexed_count++;
      continue;
    }

    // Stalled on RPM — same reasoning as reindexAll: this clears within a
    // minute, so wait it out once rather than failing a whole document
    // over a transient window that a bulk upload's earlier chunks could
    // easily have caused.
    console.warn("[document_embedding.service] RPM stall, waiting 60s", {
      document_id,
      chunk_index: chunk.chunk_index,
    });
    await new Promise((resolve) => setTimeout(resolve, 60_000));
    const retryOk = await embedAndInsertOneChunk(document_id, chunk, model);
    if (retryOk) {
      indexed_count++;
      continue;
    }

    // Retry also failed (or it wasn't an RPM stall at all — e.g. daily
    // budget exhausted, which won't clear until tomorrow no matter how
    // long we wait). Stop here rather than burning through the rest of
    // this document's chunks against a budget that's already gone.
    console.error(
      "[document_embedding.service] embedding failed after retry, stopping — rolling back partial chunks",
      { document_id, indexed_count, total_count },
    );
    await rollbackAndMarkFailed(document_id);
    return { indexed_count: 0, total_count, stopped_early: true };
  }

  await db("document").where({ document_id }).update({ status: "indexed" });
  return { indexed_count, total_count, stopped_early: false };
}

/**
 * Embeds one chunk and inserts it. Returns false (never throws) on any
 * budget/RPM/embedding-call failure so the caller can decide whether to
 * retry — throwing here would make the retry-once logic above
 * indistinguishable from a genuine bug, which is exactly the ambiguity
 * reindexAll's ApiError-status-code check has to work around; returning
 * a plain boolean sidesteps that entirely for this simpler single-model
 * call site.
 */
async function embedAndInsertOneChunk(
  document_id: number,
  chunk: DocumentChunk,
  model: string,
): Promise<boolean> {
  const reserved = await GeminiBudget.tryReserve(
    model,
    chatConfig.budgets.embedding,
    chatConfig.rpm.embedding,
  );
  if (!reserved.ok) {
    return false;
  }

  let embedding: number[];
  try {
    ({ embedding } = await embed({
      model: geminiProvider.embeddingModel(model),
      value: chunk.content,
      providerOptions: {
        google: {
          outputDimensionality: chatConfig.embeddingDimensions,
          taskType: "RETRIEVAL_DOCUMENT",
        } satisfies GoogleGenerativeAIEmbeddingProviderOptions,
      },
    }));
  } catch (err) {
    console.error(
      "[document_embedding.service] embed() call failed — refunding budget",
      { document_id, chunk_index: chunk.chunk_index, err },
    );
    await GeminiBudget.refund(reserved.reservation);
    return false;
  }

  // pgvector accepts a bracketed literal string cast to ::vector — same
  // approach as embedding.service.ts, since knex has no native vector
  // type binding.
  const vectorLiteral = `[${embedding.join(",")}]`;

  await db.raw(
    `
    INSERT INTO document_chunk (document_id, content, embedding, chunk_index)
    VALUES (?, ?, ?::vector, ?)
    `,
    [document_id, chunk.content, vectorLiteral, chunk.chunk_index],
  );

  return true;
}

async function rollbackAndMarkFailed(document_id: number): Promise<void> {
  // Cheaper to just let ON DELETE CASCADE handle this by deleting the
  // document row entirely, but that would also throw away title/s3_url/
  // uploaded_by — information the admin document-list UI (step 11) still
  // needs to show a failed row with a "reindex" action (plan §4.4's
  // POST /admin/documents/:id/reindex). So delete only the chunks,
  // explicitly, and leave the document row itself intact with
  // status = 'failed'.
  await db.transaction(async (trx) => {
    await trx("document_chunk").where({ document_id }).del();
    await trx("document").where({ document_id }).update({ status: "failed" });
  });
}
