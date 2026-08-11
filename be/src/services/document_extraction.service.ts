import path from "path";
import { PDFParse } from "pdf-parse";

/**
 * Text extraction for the RAG document upload feature
 * (rag-document-upload-plan.md §4.2, step 3).
 *
 * Plain text/markdown need no extraction — the uploaded bytes ARE the
 * content, decoded as UTF-8. PDFs are parsed with `pdf-parse` (v2, the
 * class-based `PDFParse` API — NOT the old v1 `pdf(buffer)` function
 * signature some older examples online still show).
 *
 * Deliberately takes a raw Buffer + the original MIME type/filename,
 * decoupled from *where* that buffer came from — the upload middleware
 * (documentUpload.ts) streams straight to S3 via multer-s3 rather than
 * buffering in memory, so the indexing pipeline (step 5) will fetch the
 * object back from S3 before calling this, not pass `req.file.buffer`
 * directly. Keeping extraction buffer-in/text-out keeps it testable in
 * isolation from that S3 round-trip.
 *
 * No OCR (plan §5, explicit out-of-scope) — a scanned/image-only PDF is a
 * structurally valid PDF that `pdf-parse` will happily "succeed" on, just
 * returning empty or near-empty text per page, since there's no embedded
 * text layer to extract. Silently indexing that as zero chunks would look
 * like a successful upload of nothing, so MIN_EXTRACTED_TEXT_LENGTH below
 * turns "extracted almost nothing" into an explicit thrown
 * DocumentExtractionError instead — the caller (step 5's indexing
 * pipeline) is expected to catch this and set document.status = 'failed'
 * with the message, not just move on with an empty chunk set.
 */

// Not zero — a PDF could have a handful of stray extracted characters
// (e.g. a page number, a watermark) despite being effectively all-image
// content. This is a deliberately low bar: it's here to catch "nothing
// useful was extracted", not to judge extraction *quality*.
const MIN_EXTRACTED_TEXT_LENGTH = 10;

export class DocumentExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

/**
 * Extract plain text content from an uploaded document's raw bytes.
 * Throws DocumentExtractionError (never returns an empty/near-empty
 * string silently) if extraction fails or yields effectively nothing.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimetype: string,
  originalFilename: string,
): Promise<string> {
  const ext = path.extname(originalFilename).toLowerCase();
  const isPdf = mimetype === "application/pdf" || ext === ".pdf";

  const text = isPdf ? await extractPdfText(buffer) : extractPlainText(buffer);

  const normalized = text.trim();
  if (normalized.length < MIN_EXTRACTED_TEXT_LENGTH) {
    throw new DocumentExtractionError(
      isPdf
        ? "No extractable text found in this PDF — it may be scanned or " +
            "image-only, which isn't supported (no OCR)."
        : "This file appears to be empty.",
    );
  }
  return normalized;
}

function extractPlainText(buffer: Buffer): string {
  // Plain text/markdown needs no extraction — the bytes ARE the content.
  // UTF-8 covers plain text and markdown for this feature's scope; no
  // encoding-detection (e.g. Latin-1 fallback) attempted, matching the
  // plan's "no OCR" simplicity bar for v1 — a mis-encoded file will
  // produce garbled/replacement-character text rather than a clean
  // failure, which is a known gap, not silently "fixed" by guessing.
  return buffer.toString("utf-8");
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  let parser: PDFParse;
  try {
    parser = new PDFParse({ data: buffer });
  } catch (err) {
    throw new DocumentExtractionError(
      `Could not open this file as a PDF: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const result = await parser.getText();
    return result.text;
  } catch (err) {
    // Covers corrupt/malformed PDFs, encrypted PDFs without a supplied
    // password (LoadParameters.password is never set here — password-
    // protected documents are out of scope for v1, same as OCR), and any
    // other pdfjs-dist parse-time failure. All surfaced as one
    // DocumentExtractionError rather than left as an unhandled throw, so
    // the indexing pipeline can uniformly catch extraction failures
    // regardless of which specific way the PDF was unreadable.
    throw new DocumentExtractionError(
      `Failed to parse PDF: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    // Releases the underlying pdfjs-dist document/worker resources.
    // Always run this, success or failure, or a bad PDF leaks memory.
    await parser.destroy();
  }
}
