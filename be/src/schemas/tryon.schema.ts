import { z } from "zod";

export const createSessionSchema = z.object({
  body: z.object({
    product_id: z.coerce.number().int().positive(),
    variant_id: z.coerce.number().int().positive(),
  }),
});

export const submitPreviewSchema = z.object({
  body: z.object({
    session_id: z.number().int().positive(),
    product_id: z.number().int().positive(),
    variant_id: z.number().int().positive(),
  }),
});

export const sessionParamsSchema = z.object({
  params: z.object({
    session_id: z.coerce.number().int().positive(),
  }),
});
