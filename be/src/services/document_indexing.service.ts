/**
 * services/document_indexing.service.ts
 *
 * Orchestrates the full indexing pipeline for one document
 * (rag-document-upload-plan.md §4.2: extraction -> chunk -> embed).
 * Each of those three steps already exists as its own module
 * (document_extraction.service.ts, document_chunking.service.ts,
 * document_embedding.service.ts) — this is just the glue that calls them
 * in order and guarantees the document row always ends up in a
 * definitive terminal status (`indexed` or `failed`), regardless of
 * which step fails.
 *
 * Called fire-and-forget from the upload route (§4.4: "indexing is
 * triggered automatically... the moment the request is accepted") —
 * NOT awaited as part of the HTTP response, so the admin gets an
 * immediate 201 with status = 'processing' and the document list page
 * (§4.5) is what shows the eventual indexed/failed outcome. This mirrors
 * this codebase's own established pattern for exactly this kind of
 * "confirm now, do slower work after" flow — see order.service.ts's GHN
 * shipment creation, which used to fail silently with no way to notice
 * or retry until that was fixed; the lesson from that bug is why this
 * function is careful to (a) never let an error escape uncaught and (b)
 * always leave the row in a status an admin can act on, never stuck in
 * 'processing' forever.
 */
import db from "../config/db.js";
import * as StorageService from "./storage.service.js";
import {
  extractDocumentText,
  DocumentExtractionError,
} from "./document_extraction.service.js";
import { chunkText } from "./document_chunking.service.js";
import { embedAndStoreChunks } from "./document_embedding.service.js";

/**
 * Runs extraction -> chunk -> embed for one already-inserted document
 * row (status = 'processing', zero chunks). Never throws — every failure
 * path is caught and turned into `document.status = 'failed'`, since
 * this is called fire-and-forget and an uncaught rejection here would be
 * an unhandled promise rejection with no other observer.
 *
 * @param document_id  Row already inserted by DocumentModel.insertDocument.
 * @param s3Key        e.g. "documents/<uuid>.pdf" — multer-s3's file.key.
 * @param filename     Original filename, used only to decide PDF vs plain
 *                      text by extension (document_extraction.service.ts's
 *                      isPdf check) — no separate mimetype column exists
 *                      on `document`, and the extension already carries
 *                      that information both at first upload (where the
 *                      real file.mimetype IS available but isn't stored)
 *                      and at reindex time (where only s3_url/title
 *                      survive) — passing filename-only here keeps both
 *                      call sites identical rather than one taking a
 *                      mimetype the other can't reconstruct.
 */
export async function indexDocument(
  document_id: number,
  s3Key: string,
  filename: string,
): Promise<void> {
  try {
    const buffer = await StorageService.getObjectBuffer(s3Key);
    // mimetype param left empty — extractDocumentText's isPdf check falls
    // back to the filename extension, which is always available here
    // (see param doc above), so an empty mimetype never actually matters.
    const text = await extractDocumentText(buffer, "", filename);
    const chunks = chunkText(text);
    const result = await embedAndStoreChunks(document_id, chunks);

    if (result.stopped_early) {
      // embedAndStoreChunks already rolled back partial chunks and set
      // status = 'failed' itself — nothing left to do here but log.
      console.error(
        "[document_indexing.service] indexDocument: embedding stopped early (budget/RPM exhausted)",
        { document_id, ...result },
      );
    } else {
      console.log("[document_indexing.service] indexDocument succeeded", {
        document_id,
        chunk_count: result.indexed_count,
      });
    }
  } catch (err) {
    // Covers: S3 fetch failure, extraction failure (corrupt/scanned PDF —
    // DocumentExtractionError), or chunking failure (shouldn't happen in
    // practice since extraction already guarantees non-trivial text, but
    // not assumed away). embedAndStoreChunks manages its own status
    // updates on ITS failures (see above) — this catch only needs to
    // handle the steps BEFORE it, which never touch document.status
    // themselves.
    const message =
      err instanceof DocumentExtractionError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.error(
      "[document_indexing.service] indexDocument failed before embedding",
      { document_id, s3Key, filename, message },
    );
    await db("document")
      .where({ document_id })
      .update({ status: "failed" })
      .catch((updateErr) => {
        // If even the status update fails (DB down?), there's nothing
        // further this function can do — logged for visibility, not
        // rethrown, since this is fire-and-forget with no caller to
        // propagate to.
        console.error(
          "[document_indexing.service] failed to mark document as failed",
          { document_id, updateErr },
        );
      });
  }
}
