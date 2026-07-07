import { z } from "zod";

/**
 * schemas/auth.schema.ts
 *
 * Zod v4 validation schemas for auth routes.
 * Column constraints from schema reference (§9):
 *   "USER".username  VARCHAR(50) NOT NULL
 *   "USER".email     VARCHAR(50) NOT NULL
 *   "USER".phone     CHAR(10)    NOT NULL — exactly 10 digits
 *   "USER".address   VARCHAR(70) NOT NULL
 *   "USER".password_hash stored; raw password validated here before hashing
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
    address: z.string().min(1).max(70).trim(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});

export const logoutSchema = refreshSchema;

// Update types
export type RegisterBody = z.infer<typeof registerSchema>["body"];
export type LoginBody = z.infer<typeof loginSchema>["body"];
export type RefreshBody = z.infer<typeof refreshSchema>["body"];
export type LogoutBody = z.infer<typeof logoutSchema>["body"];
