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
  username: z
    .string()
    .min(2, "Username must be at least 2 characters")
    .max(50, "Username must be at most 50 characters")
    .trim(),
  email: z
    .string()
    .email("Invalid email address")
    .max(50, "Email must be at most 50 characters") // VARCHAR(50) in DDL
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"), // bcrypt limit
  phone: z
    .string()
    .length(10, "Phone must be exactly 10 digits") // CHAR(10) NOT NULL
    .regex(/^\d{10}$/, "Phone must contain only digits"),
  address: z
    .string()
    .min(1, "Address is required")
    .max(70, "Address must be at most 70 characters") // VARCHAR(70) NOT NULL
    .trim(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

// Both /refresh and /logout expect the same body shape.
// A single schema covers both — imported under the right name at each call site.
export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const logoutSchema = refreshSchema;

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type RefreshBody = z.infer<typeof refreshSchema>;
export type LogoutBody = z.infer<typeof logoutSchema>;
