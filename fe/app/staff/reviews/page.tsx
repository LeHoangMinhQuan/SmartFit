"use client";

import { useState } from "react";
import { Star, Trash2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { staffReviewService } from "../../../services/staff/review.service";
import type { AdminReview } from "../../../services/staff/review.service";
import { useStaffAuthStore } from "../../../store/useStaffAuthStore";
import { toast } from "../../../components/ui/Toast";
import Spinner from "../../../components/ui/Spinner";
import Pagination from "../../../components/ui/Pagination";
import ReplyList from "../../../components/ReplyList";
import type { ReviewReply } from "../../../interfaces";

const LIMIT = 20;

/**
 * app/staff/reviews/page.tsx
 *
 * Two independent capabilities live on this page, and it's worth being
 * clear about which is which since they follow different rules:
 *
 * - Deleting a REVIEW (the trash icon on the card header) is the
 *   existing staff/admin MODERATION path — GET/DELETE /admin/reviews —
 *   any staff or admin can remove any customer's review, no ownership
 *   check. That was already built before this feature; this page is
 *   just its first UI.
 * - Posting/deleting a REPLY (inside <ReplyList>) is the NEW feature —
 *   staff/admin (and customers, on the product page) can all reply, but
 *   per the confirmed rule, can only delete a reply they personally
 *   wrote. There is deliberately no moderation override for other
 *   people's replies yet — see review.routes.ts's comment on that open
 *   question if that's ever wanted.
 */
function ReviewRow({ review }: { review: AdminReview }) {
  const staffId = useStaffAuthStore((s) => s.staffId);
  const staffName = useStaffAuthStore((s) => s.name);
  const queryClient = useQueryClient();
  const currentActor = staffId ? { type: "staff" as const, id: staffId } : null;

  // Replies aren't included on the admin listing (findAllReviews doesn't
  // attach them, unlike findReviewsByProduct on the customer side) —
  // fetched lazily per row instead of eagerly for every review on the
  // page.
  const { data: replies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ["staff-review-replies", review.review_id],
    queryFn: () => staffReviewService.getReplies(review.review_id),
  });

  const postReplyMutation = useMutation({
    mutationFn: (comment: string) =>
      staffReviewService.postReply(review.review_id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["staff-review-replies", review.review_id],
      });
    },
    onError: () => toast.error("Failed to post reply."),
  });

  const deleteReplyMutation = useMutation({
    mutationFn: (reply_id: number) => staffReviewService.deleteReply(reply_id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["staff-review-replies", review.review_id],
      });
    },
    onError: () => toast.error("Failed to delete reply."),
  });

  const deleteReviewMutation = useMutation({
    mutationFn: () =>
      staffReviewService.deleteReview(
        review.product_id,
        review.variant_id,
        review.user_id,
        review.review_id,
      ),
    onSuccess: () => {
      toast.success("Review removed.");
      queryClient.invalidateQueries({ queryKey: ["staff-reviews"] });
    },
    onError: () => toast.error("Failed to remove review."),
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {review.product_name ?? `Product #${review.product_id}`}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-semibold text-slate-900">
              {review.username}
            </span>
            <span className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-3.5 w-3.5 ${
                    star <= review.rating
                      ? "fill-amber-400 text-amber-400"
                      : "fill-slate-100 text-slate-200"
                  }`}
                />
              ))}
            </span>
          </div>
        </div>

        {/* Moderation delete — any staff/admin, any review. */}
        <button
          type="button"
          onClick={() => {
            if (confirm("Remove this review? This cannot be undone."))
              deleteReviewMutation.mutate();
          }}
          disabled={deleteReviewMutation.isPending}
          aria-label="Remove review"
          className="shrink-0 text-slate-400 transition hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Staff moderation: remove this review"
        >
          {deleteReviewMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-600">{review.comment}</p>

      {repliesLoading ? (
        <div className="mt-3 pl-4">
          <Spinner size="sm" />
        </div>
      ) : (
        <ReplyList
          replies={replies as ReviewReply[]}
          currentActor={currentActor}
          staffLabel={staffName ? undefined : "Staff"}
          onPostReply={(comment) => postReplyMutation.mutateAsync(comment)}
          onDeleteReply={(reply_id) =>
            deleteReplyMutation.mutateAsync(reply_id)
          }
        />
      )}
    </div>
  );
}

export default function StaffReviewsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-reviews", page],
    queryFn: () => staffReviewService.listReviews({ page, limit: LIMIT }),
  });
  const reviews = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every customer review, across all products. Reply to any of them — you
          can only delete replies you wrote yourself, but as staff you can
          remove a review outright if it needs moderating.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="md" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          No reviews yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((r) => (
            <ReviewRow key={`${r.user_id}-${r.review_id}`} review={r} />
          ))}
        </div>
      )}

      {meta && <Pagination meta={meta} onPageChange={setPage} />}
    </div>
  );
}
