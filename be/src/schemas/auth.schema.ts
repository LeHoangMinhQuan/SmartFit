import { z } from "zod";

/**
 * schemas/auth.schema.ts
 *
 * Zod v4 validation schemas for auth routes.
 * Column constraints from schema reference (§9):
 *   "USER".username  VARCHAR — no explicit limit in schema, keep reasonable
 *   "USER".email     VARCHAR — no explicit limit
 *   "USER".phone     CHAR(10) — exactly 10 chars
 *   "USER".password_hash stored; raw password validated here before hashing
 */

export const registerSchema = z.object({
  username: z
    .string()
    .min(2, "Username must be at least 2 characters")
    .max(50, "Username must be at most 50 characters")
    .trim(),
  email: z
    .string()
    .email("Invalid email address")
    .max(100, "Email must be at most 100 characters")
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"), // bcrypt limit
  phone: z
    .string()
    .length(10, "Phone must be exactly 10 digits") // CHAR(10) in schema
    .regex(/^\d{10}$/, "Phone must contain only digits")
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
