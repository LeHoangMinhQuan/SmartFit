/**
 * models/document.model.ts
 *
 * DB access for the `document` table (rag-document-upload-plan.md §4.1).
 * document_chunk has no separate model file, same as product_embedding's
 * convention — chunk rows are only ever touched by
 * document_embedding.service.ts and document_retrieval.service.ts
 * directly, never by a generic CRUD surface.
 */
import db from "../config/db.js";

export interface DocumentRow {
  document_id: number;
  title: string;
  s3_url: string;
  status: "processing" | "indexed" | "failed";
  uploaded_by: number | null;
  created_at: string;
}

export async function insertDocument(data: {
  title: string;
  s3_url: string;
  uploaded_by: number;
}): Promise<DocumentRow> {
  const [row] = await db("document")
    .insert({ ...data, status: "processing" })
    .returning("*");
  return row;
}

export async function findDocumentById(
  document_id: number,
): Promise<DocumentRow | undefined> {
  return db("document").where({ document_id }).first();
}

/**
 * Paginated list, newest first — same shape as adminListVouchers
 * (rows + total, so the controller can build { data, meta: { total } }).
 * No status filter param yet since the admin page (plan §4.5) is a
 * single flat list with status badges, not a filtered view — add one
 * here if that changes.
 */
export async function findAllDocuments(
  page: number,
  limit: number,
): Promise<{ rows: DocumentRow[]; total: number }> {
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db("document").orderBy("created_at", "desc").limit(limit).offset(offset),
    db("document").count("document_id as total"),
  ]);
  return { rows, total: Number(countResult[0]?.["total"] ?? 0) };
}

/**
 * ON DELETE CASCADE on document_chunk.document_id handles the chunk rows
 * — this only needs to remove the document row itself. The caller
 * (document.service.ts) is responsible for deleting the S3 object
 * first/alongside, since that's not something a DB delete can do.
 */
export async function deleteDocument(document_id: number): Promise<void> {
  await db("document").where({ document_id }).del();
}

export async function updateStatus(
  document_id: number,
  status: DocumentRow["status"],
): Promise<void> {
  await db("document").where({ document_id }).update({ status });
}
