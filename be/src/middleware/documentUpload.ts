import multer from "multer";
import multerS3 from "multer-s3";
import { Request } from "express";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { s3 } from "../config/s3.js";
import { env } from "../config/env.js";

/**
 * Manual document upload for the RAG knowledge base (rag-document-upload-plan.md).
 *
 * Uploads to S3 under documents/{uuid}.ext — a dedicated prefix, same public-read
 * CloudFront pattern as products/categories (see upload.ts), NOT the private
 * per-user pattern tryonUpload.ts uses. These are customer-facing documents
 * (terms, policies, FAQs), meant to be publicly viewable via CloudFront —
 * only the upload/delete/reindex admin actions are access-controlled, not
 * read access to the file itself. See plan §1.
 *
 * The resulting s3_url (built via storage.service.ts's cdnUrlForKey) is
 * stored in document.s3_url by the service layer. document.document_id is
 * GENERATED ALWAYS AS IDENTITY — the DB returns it on insert.
 *
 * PDF and plain-text/markdown only (plan §4.2 — no OCR, so scanned/image-only
 * PDFs aren't rejected here, but will fail extraction downstream and should
 * surface as document.status = 'failed', not silently produce empty chunks).
 *
 * MIME type checking alone is unreliable for .md specifically — some
 * browsers/OSes report it as text/markdown, some fall back to text/plain
 * (already allowed), and some report application/octet-stream with no
 * useful type info at all. Rather than reject that last case outright, the
 * filter also accepts application/octet-stream IF the filename extension is
 * one of the allowed ones — a real gap image uploads don't have (image MIME
 * reporting is far more consistent across browsers/OS), not over-engineered
 * to also sniff file content/magic bytes, matching upload.ts's simplicity.
 *
 * Limits: 5 files max per request, 20 MB each — higher per-file cap than
 * upload.ts's 5MB image limit (PDFs run larger than product photos), lower
 * file count than its 10 (bulk upload here can enqueue dozens of embedding
 * calls per file downstream — see plan §4.2's embedding-pipeline row — so
 * this caps how much a single request can dump on that budget at once).
 *
 * S3 credentials come from the shared s3 client (config/s3.ts) — EC2 IAM
 * instance role via IMDSv2, no keys needed, same as upload.ts/tryonUpload.ts.
 */

const S3_PREFIX = "documents";

const ALLOWED_MIME_TYPES = ["application/pdf", "text/plain", "text/markdown"];
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_FILE_COUNT = 5;

const s3Storage = multerS3({
  s3,
  bucket: env.S3_BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: any, key?: string) => void,
  ) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${S3_PREFIX}/${uuidv4()}${ext}`);
  },
});

const documentFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);
  // See the file-level comment above — application/octet-stream is what
  // some browsers/OSes fall back to for .md (and occasionally .txt) when
  // they don't have a specific MIME mapping registered, so it's allowed
  // here ONLY paired with a matching extension, not on its own.
  const octetStreamWithKnownExt =
    file.mimetype === "application/octet-stream" &&
    ALLOWED_EXTENSIONS.includes(ext);

  if (mimeOk || octetStreamWithKnownExt) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE" as multer.ErrorCode,
        `Unsupported file type "${file.mimetype}" for "${file.originalname}". Allowed: PDF, plain text, markdown`,
      ),
    );
  }
};

const uploader = multer({
  storage: s3Storage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILE_COUNT,
  },
});

/**
 * POST /api/admin/documents — 1 to 5 documents in a single request, field
 * name: "documents". Each file becomes its own `document` row; indexing
 * (extraction → chunk → embed) is triggered automatically per file the
 * moment the request is accepted — see plan §4.2/§4.4. Matches uploadBulk's
 * shape in upload.ts (uploader.array), just a different field name/prefix/
 * file-type allowlist.
 */
export const uploadDocuments = uploader.array("documents", MAX_FILE_COUNT);
