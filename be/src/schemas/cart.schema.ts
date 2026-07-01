import { z } from "zod";

export const addCartItemSchema = z.object({
  body: z.object({
    product_id: z.number().int().positive(),
    variant_id: z.number().int().positive(),
    quantity: z.number().int().positive(),
  }),
});

export const updateCartItemSchema = z.object({
  body: z.object({
    product_id: z.number().int().positive(),
    variant_id: z.number().int().positive(),
    quantity: z.number().int().min(1),
  }),
});

export const removeCartItemSchema = z.object({
  body: z.object({
    product_id: z.number().int().positive(),
    variant_id: z.number().int().positive(),
  }),
});

export const mergeCartSchema = z.object({
  body: z.object({
    items: z.array(
      z.object({
        product_id: z.number().int().positive(),
        variant_id: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    ),
  }),
});
