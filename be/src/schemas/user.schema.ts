import { z } from "zod";
import {
  VN_PHONE_REGEX,
  VN_PHONE_ERROR_MESSAGE,
  PASSWORD_STRENGTH_REGEX,
  PASSWORD_ERROR_MESSAGE,
} from "../utils/validators.js";

export const updateProfileSchema = z.object({
  body: z.object({
    username: z.string().min(1).max(30).optional(),
    phone: z.string().regex(VN_PHONE_REGEX, VN_PHONE_ERROR_MESSAGE).optional(),
    avatar_url: z.string().url().optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    old_password: z.string().min(1),
    new_password: z
      .string()
      .min(8)
      .max(72)
      .regex(PASSWORD_STRENGTH_REGEX, PASSWORD_ERROR_MESSAGE),
  }),
});

export const createAddressSchema = z.object({
  body: z.object({
    address_line: z.string().min(1).max(20),
    province_id: z.number().int().positive(),
    district_id: z.number().int().positive(),
    ward_id: z.number().int().positive(),
    // Required — this is the gate for GHN shipment creation having a
    // deliverable contact number. Not sourced from USER.phone: that's
    // nullable (Google-authenticated accounts have none) and isn't
    // necessarily who should receive a delivery to this address anyway.
    phone: z.string().regex(VN_PHONE_REGEX, VN_PHONE_ERROR_MESSAGE),
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
    phone: z.string().regex(VN_PHONE_REGEX, VN_PHONE_ERROR_MESSAGE).optional(),
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
