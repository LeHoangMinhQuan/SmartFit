"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productService } from "../../services/product.service";
import { reviewService } from "../../services/review.service";
import { useAuthStore } from "../../store/useAuthStore";
import { toast } from "../ui/Toast";
import Spinner from "../ui/Spinner";
import ReviewCard from "./ReviewCard";
import { Star, MessageSquareDashed } from "lucide-react";

interface ReviewSectionProps {
  product_id: number;
  variant_id: number | null;
}

export default function ReviewSection({
  product_id,
  variant_id,
}: ReviewSectionProps) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  const {
    data: reviews = [],
    isLoading: loading,
    isError,
  } = useQuery({
    queryKey: ["reviews", product_id],
    queryFn: async () => (await productService.getReviews(product_id)).data,
  });

  useEffect(() => {
    if (isError) toast.error("Failed to load reviews.");
  }, [isError]);

  const alreadyReviewed = !!(
    user && reviews.some((r) => r.user_id === user.user_id)
  );

  // Identifies "me" for ReplyList/ReviewCard's ownership checks — this
  // section only ever runs as a customer (or logged out), never staff;
  // see components/ReplyList.tsx's doc comment for the staff-side
  // equivalent in the dashboard.
  const currentActor = user
    ? { type: "customer" as const, id: user.user_id }
    : null;

  const submitReviewMutation = useMutation({
    mutationFn: () =>
      reviewService.submitReview(product_id, variant_id as number, {
        rating,
        comment,
      }),
    onSuccess: () => {
      toast.success("Review submitted!");
      setComment("");
      setRating(5);
      setHoverRating(0);
      queryClient.invalidateQueries({ queryKey: ["reviews", product_id] });
    },
    onError: (err) => {
      // Backend now rejects reviews from customers who haven't purchased
      // the item (403) or who already reviewed it (409) — surface those
      // specific messages instead of a generic "failed" toast, since
      // they're actionable-to-understand, not transient failures worth
      // retrying.
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? "Failed to submit review.")
        : "Failed to submit review.";
      toast.error(message);
    },
  });
  const submitting = submitReviewMutation.isPending;

  // Only the review's own creator can delete it — enforced server-side
  // too (review.routes.ts's DELETE looks the row up scoped to the
  // caller's own user_id first), this is just so the button only shows
  // where it'll actually work.
  const deleteReviewMutation = useMutation({
    mutationFn: ({
      review_id,
      variant_id: v,
    }: {
      review_id: number;
      variant_id: number;
    }) => reviewService.deleteReview(product_id, v, review_id),
    onSuccess: () => {
      toast.success("Review deleted.");
      queryClient.invalidateQueries({ queryKey: ["reviews", product_id] });
    },
    onError: () => toast.error("Failed to delete review."),
  });

  const postReplyMutation = useMutation({
    mutationFn: ({
      review_id,
      comment: replyComment,
    }: {
      review_id: number;
      comment: string;
    }) => reviewService.postReply(review_id, replyComment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", product_id] });
    },
    onError: () => toast.error("Failed to post reply."),
  });

  // Ownership-scoped on the backend too (deleteReplyByCustomer) — only
  // the reply's own author can delete it, not the review's author and
  // not staff/admin (see review.routes.ts's comment on this exact rule).
  const deleteReplyMutation = useMutation({
    mutationFn: (reply_id: number) => reviewService.deleteReply(reply_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", product_id] });
    },
    onError: () => toast.error("Failed to delete reply."),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!variant_id) {
      toast.error("Select a variant before reviewing.");
      return;
    }
    submitReviewMutation.mutate();
  }

  return (
    <section className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Customer Reviews
        </h2>
        {!loading && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            {reviews.length} {reviews.length === 1 ? "Review" : "Reviews"}
          </span>
        )}
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner size="md" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center">
          <MessageSquareDashed className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No reviews yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Be the first to share your thoughts on this item!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {reviews.map((r) => (
            <ReviewCard
              key={`${r.user_id}-${r.review_id}`}
              username={r.username}
              rating={r.rating}
              comment={r.comment}
              replies={r.replies}
              currentActor={currentActor}
              isOwnReview={!!user && r.user_id === user.user_id}
              deletingReview={
                deleteReviewMutation.isPending &&
                deleteReviewMutation.variables?.review_id === r.review_id
              }
              onDeleteReview={
                user
                  ? () =>
                      deleteReviewMutation.mutateAsync({
                        review_id: r.review_id,
                        variant_id: r.variant_id,
                      })
                  : undefined
              }
              onPostReply={
                currentActor
                  ? (comment) =>
                      postReplyMutation.mutateAsync({
                        review_id: r.review_id,
                        comment,
                      })
                  : undefined
              }
              onDeleteReply={
                currentActor
                  ? (reply_id) => deleteReplyMutation.mutateAsync(reply_id)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Review Form */}
      {user && alreadyReviewed && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          You've already reviewed this item. Thanks for sharing your thoughts!
        </div>
      )}
      {user && !alreadyReviewed && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <h3 className="text-lg font-semibold text-slate-900">
              Write a Review
            </h3>

            {/* Interactive Star Rating */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-slate-700">
                Overall Rating
              </label>
              <div
                className="flex gap-1"
                onMouseLeave={() => setHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= (hoverRating || rating);
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      className="transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={`h-6 w-6 transition-colors duration-200 ${
                          isFilled
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300 hover:text-amber-200"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Comment Textarea */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="comment"
                className="text-sm font-medium text-slate-700"
              >
                Your Experience
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How does this item fit? What do you love about it?"
                rows={4}
                required
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 self-start rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:pointer-events-none disabled:opacity-40"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" className="text-white" />
                  Submitting...
                </span>
              ) : (
                "Submit Review"
              )}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
