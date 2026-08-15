import api from "../../lib/staffAxios";
import type { Review, ReviewReply } from "../../interfaces";

interface ApiResponse<T> {
  data: T;
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// findAllReviews (backend) joins in the product name for this listing —
// not part of the base Review shape used on the customer product page.
export interface AdminReview extends Review {
  product_name?: string;
}

/**
 * services/staff/review.service.ts
 *
 * Staff-dashboard equivalent of services/review.service.ts. Same backend
 * routes, different axios client (staffAxios sends the staff Bearer
 * token instead of the customer cookie — see authenticateEither.ts,
 * which accepts either transparently on the reply endpoints).
 *
 * listReviews/deleteReview here are the existing staff/admin MODERATION
 * path (GET/DELETE /admin/reviews/... — any review, any author, no
 * ownership check server-side). postReply/deleteReply below are the
 * separate reply feature: staff/admin can post a reply to any review
 * like anyone else, but per the confirmed ownership rule, can only
 * delete a reply THEY wrote themselves — there is deliberately no
 * moderation override for other people's replies yet (see
 * review.routes.ts's comment on that open question).
 */
export const staffReviewService = {
  listReviews: (params?: { page?: number; limit?: number }) =>
    api
      .get<ApiResponse<AdminReview[]>>("/admin/reviews", { params })
      .then((r) => r.data),

  deleteReview: (
    product_id: number,
    variant_id: number,
    user_id: number,
    review_id: number,
  ) =>
    api
      .delete(
        `/admin/reviews/${product_id}/${variant_id}/${user_id}/${review_id}`,
      )
      .then((r) => r.data),

  getReplies: (review_id: number) =>
    api
      .get<{ data: ReviewReply[] }>(`/reviews/${review_id}/replies`)
      .then((r) => r.data.data),

  postReply: (review_id: number, comment: string) =>
    api
      .post<{
        data: { reply_id: number; message: string };
      }>(`/reviews/${review_id}/replies`, { comment })
      .then((r) => r.data.data),

  deleteReply: (reply_id: number) =>
    api.delete(`/reviews/replies/${reply_id}`).then((r) => r.data),
};
