import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";

// ─── Payload shapes (must match §8 design decisions) ─────────────────────────

/** Payload embedded in user access tokens. No `role` — that is staff-only. */
export interface UserTokenPayload {
  user_id: number;
  email: string;
}

/** Payload embedded in staff access tokens. Uses staff.name, not username. */
export interface StaffTokenPayload {
  staff_id: number;
  name: string;
}

// ─── Token TTLs ───────────────────────────────────────────────────────────────

const ACCESS_TTL = "15m"; // short-lived access token
const REFRESH_TTL = "7d"; // refresh token lifetime (also set in refresh_token.expires_at)

// ─── User tokens ─────────────────────────────────────────────────────────────

/**
 * Sign a 15-minute access token for a USER-table user.
 * Payload: { user_id, email }
 */
export const signUserAccessToken = (payload: UserTokenPayload): string => {
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TTL } as SignOptions);
};

/**
 * Verify and decode a user access token.
 * Throws jwt.JsonWebTokenError / jwt.TokenExpiredError on failure —
 * authenticate.ts catches these and converts them to ApiError(401).
 */
export const verifyUserAccessToken = (token: string): UserTokenPayload => {
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.verify(token, secret) as UserTokenPayload;
};

// ─── Staff tokens ─────────────────────────────────────────────────────────────

/**
 * Sign a 15-minute access token for a staff-table member.
 * Payload: { staff_id, name }  ← `name` matches staff.name column (no username)
 * Uses STAFF_JWT_SECRET — separate from user JWT to prevent cross-use.
 */
export const signStaffAccessToken = (payload: StaffTokenPayload): string => {
  const secret = env.STAFF_JWT_SECRET;
  if (!secret) throw new Error("STAFF_JWT_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TTL } as SignOptions);
};

/**
 * Verify and decode a staff access token.
 */
export const verifyStaffAccessToken = (token: string): StaffTokenPayload => {
  const secret = env.STAFF_JWT_SECRET;
  if (!secret) throw new Error("STAFF_JWT_SECRET is not configured");
  return jwt.verify(token, secret) as StaffTokenPayload;
};

// ─── Refresh tokens ───────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random opaque refresh token string.
 * The raw value is returned to the client; only its hash is persisted
 * in refresh_token.token_hash (VARCHAR 255).
 */
export const generateRefreshToken = (): string =>
  crypto.randomBytes(40).toString("hex"); // 80 hex chars, well under VARCHAR(255)

/**
 * Hash a raw refresh token for storage in refresh_token.token_hash.
 * SHA-256 is sufficient — the token is already high-entropy random.
 */
export const hashRefreshToken = (rawToken: string): string =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

/**
 * Return the Date at which a newly issued refresh token expires.
 * Stored as refresh_token.expires_at.
 */
export const refreshTokenExpiresAt = (): Date => {
  const d = new Date();
  d.setDate(d.getDate() + 7); // 7-day TTL (§8)
  return d;
};

/**
 * Generate a vnpay_txn_ref for a VNPay transaction (§6).
 * Format: `${order_id}-${Date.now()}` — unique per payment attempt.
 * Fits within payment_transaction.vnpay_txn_ref VARCHAR(100).
 */
export const generateVnpTxnRef = (order_id: number): string =>
  `${order_id}-${Date.now()}`;
