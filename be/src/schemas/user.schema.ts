import { z } from "zod";

export const updateProfileSchema = z.object({
  body: z.object({
    username: z.string().min(1).max(30).optional(),
    phone: z
      .string()
      .length(10)
      .regex(/^\d+$/, "Phone must be digits only")
      .optional(),
    address: z.string().max(70).optional(),
    avatar_url: z.string().url().optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    old_password: z.string().min(1),
    new_password: z.string().min(8),
  }),
});

export const createAddressSchema = z.object({
  body: z.object({
    address_line: z.string().min(1).max(20),
    province_id: z.number().int().positive(),
    district_id: z.number().int().positive(),
    ward_id: z.number().int().positive(),
    label: z.string().max(20).optional(),
  }),
});

export const updateAddressSchema = z.object({
  params: z.object({ address_id: z.coerce.number().int().positive() }),
  body: z.object({
    address_line: z.string().min(1).max(20).optional(),
    province_id: z.number().int().positive().optional(),
    district_id: z.number().int().positive().optional(),
    ward_id: z.number().int().positive().optional(),
    label: z.string().max(20).optional(),
  }),
});

export const addressParamsSchema = z.object({
  params: z.object({ address_id: z.coerce.number().int().positive() }),
});

export const wishlistItemSchema = z.object({
  body: z.object({
    product_id: z.number().int().positive(),
    variant_id: z.number().int().positive(),
  }),
});

export const wishlistDeleteSchema = z.object({
  params: z.object({
    product_id: z.coerce.number().int().positive(),
    variant_id: z.coerce.number().int().positive(),
  }),
});
