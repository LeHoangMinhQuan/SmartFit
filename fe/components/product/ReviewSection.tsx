"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productService } from "../../services/product.service";
import { reviewService } from "../../services/review.service";
import { useAuthStore } from "../../store/useAuthStore";
import { toast } from "../ui/Toast";
import Spinner from "../ui/Spinner";
// ReviewCard already exists — adjust path if needed after migration
import ReviewCard from "./ReviewCard";

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
      queryClient.invalidateQueries({ queryKey: ["reviews", product_id] });
    },
    onError: () => toast.error("Failed to submit review."),
  });
  const submitting = submitReviewMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!variant_id) {
      toast.error("Select a variant before reviewing.");
      return;
    }
    submitReviewMutation.mutate();
  }

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-gray-900">Customer Reviews</h2>

      {loading ? (
        <Spinner />
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-500">No reviews yet — be the first!</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((r) => (
            <ReviewCard key={`${r.user_id}-${r.review_id}`} {...r} />
          ))}
        </div>
      )}

      {user && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 border-t pt-6"
        >
          <p className="font-medium text-gray-900">Write a review</p>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Rating:</label>
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n} className="text-yellow">
                  {n} ★
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience…"
            rows={3}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 outline-none focus:border-black"
          />

          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded-lg bg-black px-5 py-2 text-sm text-white disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Review"}
          </button>
        </form>
      )}
    </section>
  );
}
