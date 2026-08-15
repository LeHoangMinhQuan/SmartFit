import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { authenticateEither } from "../middleware/authenticateEither.js";
import { validate } from "../middleware/validate.js";
import { catchAsync } from "../utils/catchAsync.js";
import * as ReviewModel from "../models/review.model.js";
import { ApiError } from "../utils/ApiError.js";
import {
  createReplySchema,
  replyParamsSchema,
} from "../schemas/review.schema.js";

const router = Router();

const updateReviewSchema = z.object({
  params: z.object({
    product_id: z.coerce.number().int().positive(),
    variant_id: z.coerce.number().int().positive(),
    review_id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().min(1).max(255).optional(),
  }),
});

router.patch(
  "/:product_id/:variant_id/:review_id",
  authenticate,
  validate(updateReviewSchema),
  catchAsync(async (req, res) => {
    const user_id = (req as any).user.user_id;
    const { product_id, variant_id, review_id } = req.params;

    const existing = await ReviewModel.findReview(
      Number(product_id),
      Number(variant_id),
      user_id,
      Number(review_id),
    );
    if (!existing) throw new ApiError(404, "Review not found or not yours");

    await ReviewModel.updateReview(
      Number(product_id),
      Number(variant_id),
      user_id,
      Number(review_id),
      req.body,
    );
    res.json({ data: { message: "Review updated" } });
  }),
);

router.delete(
  "/:product_id/:variant_id/:review_id",
  authenticate,
  catchAsync(async (req, res) => {
    const user_id = (req as any).user.user_id;
    const { product_id, variant_id, review_id } = req.params;

    const existing = await ReviewModel.findReview(
      Number(product_id),
      Number(variant_id),
      user_id,
      Number(review_id),
    );
    if (!existing) throw new ApiError(404, "Review not found or not yours");

    await ReviewModel.deleteReview(
      Number(product_id),
      Number(variant_id),
      user_id,
      Number(review_id),
    );
    res.status(204).send();
  }),
);

// ─── Replies ────────────────────────────────────────────────────────────────
//
// Customer, staff, AND admin can all reply to a review — a public
// back-and-forth thread under each review, not a staff-only response
// tool. authenticateEither accepts either credential type transparently
// (see its own doc comment); which one authenticated determines whether
// the reply is attributed to user_id or staff_id.
//
// Confirmed permission rule (2026-08): ownership is per-reply, not
// per-review — a reply is deletable only by whoever wrote THAT reply,
// the same way a review is deletable only by whoever wrote that review.
// This is NOT "the review's original author can delete any reply on
// their own review" — replying and reviewing are independent actions
// with independent ownership.
//
// ⚠ Open product question, not resolved here: unlike reviews (see
// adminDeleteReview in admin.controller.ts, which lets any staff/admin
// remove ANY review as a moderation action), this owner-only rule gives
// staff/admin NO override to remove another actor's reply — including
// an abusive or inappropriate one written by a customer. If moderation
// coverage for replies is wanted, that's a deliberate additional
// capability to design (e.g. a separate adminDeleteReply, scoped
// obviously to staff/admin only, kept apart from this owner-only
// route) — not something to silently bolt on here.

router.post(
  "/:review_id/replies",
  authenticateEither,
  validate(createReplySchema),
  catchAsync(async (req, res) => {
    const { review_id } = req.params;
    const { comment } = req.body;
    const actor = req.actor!;

    const reply_id = await ReviewModel.createReply({
      review_id: Number(review_id),
      user_id: actor.type === "customer" ? actor.id : null,
      staff_id: actor.type === "staff" ? actor.id : null,
      comment,
    });
    res.status(201).json({ data: { reply_id, message: "Reply posted" } });
  }),
);

// Public, unauthenticated — same openness as GET /products/:id/reviews
// (ProductController.getProductReviews has no auth middleware either).
// findReviewsByProduct already attaches each review's reply thread
// inline for the main product-page listing; this exists for cases that
// need just one review's replies on their own (e.g. refreshing a single
// thread after posting, without refetching the whole review list).
router.get(
  "/:review_id/replies",
  catchAsync(async (req, res) => {
    const { review_id } = req.params;
    const replies = await ReviewModel.findRepliesByReview(Number(review_id));
    res.json({ data: replies });
  }),
);

router.delete(
  "/replies/:reply_id",
  authenticateEither,
  validate(replyParamsSchema),
  catchAsync(async (req, res) => {
    const { reply_id } = req.params;
    const actor = req.actor!;

    const deletedCount =
      actor.type === "customer"
        ? await ReviewModel.deleteReplyByCustomer(Number(reply_id), actor.id)
        : await ReviewModel.deleteReplyByStaff(Number(reply_id), actor.id);

    if (deletedCount === 0) {
      throw new ApiError(404, "Reply not found or not yours");
    }
    res.status(204).send();
  }),
);

export default router;
