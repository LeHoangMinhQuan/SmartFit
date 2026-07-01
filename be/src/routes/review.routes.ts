import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { catchAsync } from "../utils/catchAsync.js";
import * as ReviewModel from "../models/review.model.js";
import { ApiError } from "../utils/ApiError.js";

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

export default router;
