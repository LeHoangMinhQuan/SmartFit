import { z } from "zod";

/**
 * schemas/auth.schema.ts
 *
 * Zod v4 validation schemas for auth routes.
 * Column constraints from schema reference (§9):
 *   "USER".username  VARCHAR(50) NOT NULL
 *   "USER".email     VARCHAR(50) NOT NULL
 *   "USER".phone     CHAR(10)    NOT NULL — exactly 10 digits
 *   "USER".password_hash stored; raw password validated here before hashing
 *
 * "USER".address was dropped (see sql schema) — signup no longer collects
 * an address at all. Real address management lives entirely in the
 * address book (address/user_address tables), which the user fills in
 * from their profile after registering — see components/profile/AddressBook.tsx.
 */

export const registerSchema = z.object({
  body: z.object({
    username: z.string().min(2).max(50).trim(),
    email: z.email().max(50).trim().toLowerCase(),
    password: z.string().min(8).max(72),
    phone: z
      .string()
      .length(10)
      .regex(/^\d{10}$/),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1),
  }),
});

// /refresh and /logout no longer take a body — the refresh token travels
// as an httpOnly cookie (see controllers/auth.controller.ts), so there's
// nothing left to validate here.

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.email().trim().toLowerCase(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    // The oobCode Firebase embeds in the reset link's query string.
    oobCode: z.string().min(1),
    newPassword: z.string().min(8).max(72),
  }),
});

// Update types
export type RegisterBody = z.infer<typeof registerSchema>["body"];
export type LoginBody = z.infer<typeof loginSchema>["body"];
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>["body"];
