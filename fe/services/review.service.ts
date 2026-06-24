import api from "../lib/axios";
import type { Review } from "../interfaces";

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
      }>(`/api/products/${product_id}/variants/${variant_id}/reviews`, body)
      .then((r) => r.data),

  editReview: (
    product_id: number,
    variant_id: number,
    review_id: number,
    body: Partial<ReviewBody>,
  ) =>
    api
      .patch<Review>(
        `/api/reviews/${product_id}/${variant_id}/${review_id}`,
        body,
      )
      .then((r) => r.data),

  deleteReview: (product_id: number, variant_id: number, review_id: number) =>
    api
      .delete(`/api/reviews/${product_id}/${variant_id}/${review_id}`)
      .then((r) => r.data),
};
