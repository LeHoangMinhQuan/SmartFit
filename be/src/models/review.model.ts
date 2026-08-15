import db from "../config/db.js";

export interface Review {
  product_id: number;
  variant_id: number;
  user_id: number;
  review_id?: number; // GENERATED ALWAYS AS IDENTITY — never supply on insert
  rating: number; // SMALLINT 1–5
  comment: string; // VARCHAR(255)
}

export async function createReview(
  data: Omit<Review, "review_id">,
): Promise<number> {
  const [row] = await db("review").insert(data).returning("review_id");
  return row.review_id;
}

export async function findReviewsByProduct(
  product_id: number,
  page = 1,
  limit = 20,
) {
  const offset = (page - 1) * limit;
  const rows = await db("review as r")
    .join("USER as u", "r.user_id", "u.user_id")
    .where("r.product_id", product_id)
    .select("r.*", "u.username", "u.avatar_url")
    .orderBy("r.review_id", "desc")
    .limit(limit)
    .offset(offset);

  const totalResult = await db("review")
    .where({ product_id })
    .count("review_id as total");
  const total = totalResult[0]?.["total"] ?? 0;

  const avgRatingResult = await db("review")
    .where({ product_id })
    .avg("rating as avg_rating");
  const avg_rating = avgRatingResult[0]?.["avg_rating"] ?? 0;

  // Attach each review's reply thread in one batched query rather than
  // one query per review (see findRepliesForReviews's own doc comment).
  const replies = await findRepliesForReviews(rows.map((r) => r.review_id));
  const repliesByReview = new Map<number, typeof replies>();
  for (const reply of replies) {
    const list = repliesByReview.get(reply.review_id) ?? [];
    list.push(reply);
    repliesByReview.set(reply.review_id, list);
  }
  const rowsWithReplies = rows.map((r) => ({
    ...r,
    replies: repliesByReview.get(r.review_id) ?? [],
  }));

  return {
    rows: rowsWithReplies,
    total: Number(total),
    avg_rating: Number(avg_rating) || 0,
  };
}

export async function findReview(
  product_id: number,
  variant_id: number,
  user_id: number,
  review_id: number,
) {
  return db("review")
    .where({ product_id, variant_id, user_id, review_id })
    .first();
}

// There's no unique constraint on (product_id, variant_id, user_id) — the
// table's PK includes review_id (its own identity column), so the DB alone
// won't stop the same user from submitting the same variant twice. This is
// the app-level guard submitReview (product.service.ts) checks before
// inserting.
export async function hasReviewed(
  product_id: number,
  variant_id: number,
  user_id: number,
): Promise<boolean> {
  const row = await db("review")
    .where({ product_id, variant_id, user_id })
    .first("review_id");
  return !!row;
}

// "Verified purchase" gate for submitReview: true only if this user has an
// order — in any status that means the item actually reached them, not
// just "in cart" or "still in transit" — containing this exact
// product/variant. Deliberately excludes cancelled/refunded/pending/
// shipping orders: an order that was cancelled or never delivered isn't
// grounds to review the product itself.
export async function hasPurchased(
  product_id: number,
  variant_id: number,
  user_id: number,
): Promise<boolean> {
  const row = await db("order_item as oi")
    .join("ORDER as o", "oi.order_id", "o.order_id")
    .where({
      "oi.product_id": product_id,
      "oi.variant_id": variant_id,
      "o.user_id": user_id,
      "o.status": "delivered",
    })
    .first("oi.order_id");
  return !!row;
}

export async function updateReview(
  product_id: number,
  variant_id: number,
  user_id: number,
  review_id: number,
  data: Partial<Pick<Review, "rating" | "comment">>,
) {
  return db("review")
    .where({ product_id, variant_id, user_id, review_id })
    .update(data);
}

export async function deleteReview(
  product_id: number,
  variant_id: number,
  user_id: number,
  review_id: number,
) {
  return db("review")
    .where({ product_id, variant_id, user_id, review_id })
    .delete();
}

// Admin: delete by full composite PK (all 4 parts)
export async function adminDeleteReview(
  product_id: number,
  variant_id: number,
  user_id: number,
  review_id: number,
) {
  return db("review")
    .where({ product_id, variant_id, user_id, review_id })
    .delete();
}

export async function findAllReviews(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const rows = await db("review as r")
    .join("USER as u", "r.user_id", "u.user_id")
    .join("product as p", "r.product_id", "p.product_id")
    .select("r.*", "u.username", "p.name as product_name")
    .orderBy("r.review_id", "desc")
    .limit(limit)
    .offset(offset);
  const totalResult = await db("review").count("review_id as total");
  const total = totalResult[0]?.["total"] ?? 0;
  return { rows, total: Number(total) };
}

// ─── Replies ────────────────────────────────────────────────────────────────
//
// review_reply keys off review.review_id alone (which has its own UNIQUE
// constraint — see the SQL schema's comment on review_reply) rather than
// review's full 4-column composite PK, since a reply only needs to point
// at "the review", not the specific product/variant/user combination it
// also happens to be keyed by.
//
// Exactly one of user_id/staff_id is set on insert (customer vs.
// staff/admin author) — both NULL is possible only after the author's
// account is later deleted (ON DELETE SET NULL, not CASCADE, so the
// reply's comment text survives). The CHECK constraint only enforces
// "never both", not "exactly one" — see the schema comment for why.

export interface ReviewReply {
  reply_id?: number; // GENERATED ALWAYS AS IDENTITY — never supply on insert
  review_id: number;
  user_id?: number | null;
  staff_id?: number | null;
  comment: string; // VARCHAR(255)
  created_at?: string;
}

export async function createReply(
  data: Pick<ReviewReply, "review_id" | "user_id" | "staff_id" | "comment">,
): Promise<number> {
  const [row] = await db("review_reply").insert(data).returning("reply_id");
  return row.reply_id;
}

// Single-review reply thread (e.g. a product page fetching replies for
// one review the customer just expanded).
export async function findRepliesByReview(review_id: number) {
  return db("review_reply as rr")
    .leftJoin("USER as u", "rr.user_id", "u.user_id")
    .leftJoin("staff as s", "rr.staff_id", "s.staff_id")
    .where("rr.review_id", review_id)
    .select(
      "rr.reply_id",
      "rr.review_id",
      "rr.user_id",
      "rr.staff_id",
      "rr.comment",
      "rr.created_at",
      "u.username",
      "u.avatar_url",
      "s.name as staff_name",
    )
    .orderBy("rr.reply_id", "asc");
}

// Batched variant for a review LIST endpoint (findReviewsByProduct,
// findAllReviews) — one query for every reply across a whole page of
// reviews instead of N+1 queries, one per review. Caller groups by
// review_id itself; kept as a flat array here since grouping shape
// depends on what the caller already has in hand (a Map, or building the
// review objects it'll attach replies onto).
export async function findRepliesForReviews(review_ids: number[]) {
  if (review_ids.length === 0) return [];
  return db("review_reply as rr")
    .leftJoin("USER as u", "rr.user_id", "u.user_id")
    .leftJoin("staff as s", "rr.staff_id", "s.staff_id")
    .whereIn("rr.review_id", review_ids)
    .select(
      "rr.reply_id",
      "rr.review_id",
      "rr.user_id",
      "rr.staff_id",
      "rr.comment",
      "rr.created_at",
      "u.username",
      "u.avatar_url",
      "s.name as staff_name",
    )
    .orderBy("rr.reply_id", "asc");
}

export async function findReplyById(reply_id: number) {
  return db("review_reply").where({ reply_id }).first();
}

// Ownership-scoped deletes — mirrors updateReview/deleteReview's own
// pattern of filtering the WHERE clause by the actor's own id rather
// than fetching-then-checking in application code. Returns the number
// of rows deleted (0 means "not found, or found but not yours" — the
// caller can't distinguish those from the DB alone, same as
// deleteReview's existing behavior, and shouldn't need to: either way
// the response is the same 404/403).
export async function deleteReplyByCustomer(
  reply_id: number,
  user_id: number,
): Promise<number> {
  return db("review_reply").where({ reply_id, user_id }).delete();
}

export async function deleteReplyByStaff(
  reply_id: number,
  staff_id: number,
): Promise<number> {
  return db("review_reply").where({ reply_id, staff_id }).delete();
}
