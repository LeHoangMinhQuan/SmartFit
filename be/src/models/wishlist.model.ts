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
    .join('"USER" as u', "r.user_id", "u.user_id")
    .where("r.product_id", product_id)
    .select("r.*", "u.username", "u.avatar_url")
    .orderBy("r.review_id", "desc")
    .limit(limit)
    .offset(offset);

  const totalResult = await db("review")
    .where({ product_id })
    .count("review_id as total");
  const total = totalResult[0]?.['total'] ?? 0;

  const avgRatingResult = await db("review")
    .where({ product_id })
    .avg("rating as avg_rating");
  const avg_rating = avgRatingResult[0]?.['avg_rating'] ?? 0;
  
  return { rows, total: Number(total), avg_rating: Number(avg_rating) || 0 };
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
    .join('"USER" as u', "r.user_id", "u.user_id")
    .join("product as p", "r.product_id", "p.product_id")
    .select("r.*", "u.username", "p.name as product_name")
    .orderBy("r.review_id", "desc")
    .limit(limit)
    .offset(offset);
  const totalResult = await db("review").count("review_id as total");
  const total = totalResult[0]?.['total'] ?? 0;
  return { rows, total: Number(total) };
}
