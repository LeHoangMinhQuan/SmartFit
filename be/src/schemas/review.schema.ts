import { z } from "zod";

export const createReplySchema = z.object({
  params: z.object({
    review_id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    comment: z.string().min(1).max(255),
  }),
});

export const replyParamsSchema = z.object({
  params: z.object({
    reply_id: z.coerce.number().int().positive(),
  }),
});
