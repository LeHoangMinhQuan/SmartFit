import api from "../lib/axios";
import type { Review, ReviewReply } from "../interfaces";

interface ReviewBody {
  rating: number; // 1–5
  comment: string;
}

export const reviewService = {
  // Submit a new review. review_id is GENERATED ALWAYS AS IDENTITY — returned by server.
  submitReview: (product_id: number, variant_id: number, body: ReviewBody) =>
    api
      .post<{
        review_id: number;
      }>(`/products/${product_id}/variants/${variant_id}/reviews`, body)
      .then((r) => r.data),

  editReview: (
    product_id: number,
    variant_id: number,
    review_id: number,
    body: Partial<ReviewBody>,
  ) =>
    api
      .patch<Review>(`/reviews/${product_id}/${variant_id}/${review_id}`, body)
      .then((r) => r.data),

  deleteReview: (product_id: number, variant_id: number, review_id: number) =>
    api
      .delete(`/reviews/${product_id}/${variant_id}/${review_id}`)
      .then((r) => r.data),

  // Replies — backend accepts either a customer (cookie, this `api`
  // instance already sends withCredentials) or staff (Bearer header)
  // credential on the same endpoint. This customer-facing service only
  // ever calls it as a logged-in customer; see services/staff/review.service.ts
  // for the staff-panel equivalent using the staff Bearer-auth client.
  postReply: (review_id: number, comment: string) =>
    api
      .post<{
        data: { reply_id: number; message: string };
      }>(`/reviews/${review_id}/replies`, { comment })
      .then((r) => r.data.data),

  deleteReply: (reply_id: number) =>
    api.delete(`/reviews/replies/${reply_id}`).then((r) => r.data),
};

export type { ReviewReply };
