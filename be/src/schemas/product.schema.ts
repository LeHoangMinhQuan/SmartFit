import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(20),
    description: z.string().min(1).max(100),
    category_ids: z.array(z.number().int().positive()).optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    name: z.string().min(1).max(20).optional(),
    description: z.string().min(1).max(100).optional(),
    category_ids: z.array(z.number().int().positive()).optional(),
  }),
});

export const productParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const searchProductsSchema = z.object({
  query: z.object({
    q: z.string().min(1),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const listProductsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    sort: z.string().optional(),
    category_id: z.coerce.number().int().positive().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    attribute_id: z.coerce.number().int().positive().optional(),
  }),
});

export const createVariantSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    variant_id: z.number().int().positive(),
    name: z.string().min(1).max(100),
  }),
});

export const variantParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    variant_id: z.coerce.number().int().positive(),
  }),
});

export const upsertPriceSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    variant_id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    base_price: z.number().positive(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
  }),
});

export const createAttributeSchema = z.object({
  body: z.object({ name: z.string().min(1).max(20) }),
});

export const attachAttributeSchema = z.object({
  params: z.object({
    product_id: z.coerce.number().int().positive(),
    variant_id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    attribute_id: z.number().int().positive(),
    value: z.string().min(1).max(20),
  }),
});

export const updateAttributeValueSchema = z.object({
  params: z.object({
    product_id: z.coerce.number().int().positive(),
    variant_id: z.coerce.number().int().positive(),
    attribute_id: z.coerce.number().int().positive(),
  }),
  body: z.object({ value: z.string().min(1).max(20) }),
});

export const categorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(30),
    parent_id: z.number().int().positive().nullable().optional(),
  }),
});

export const submitReviewSchema = z.object({
  params: z.object({
    product_id: z.coerce.number().int().positive(),
    variant_id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().min(1).max(255),
  }),
});
