/**
 * env.ts
 *
 * Validates all required environment variables at process startup.
 * Import this first in app.ts — if anything is missing the process exits
 * immediately with a clear message instead of failing silently at runtime.
 *
 * AWS credentials are NOT environment variables — the EC2 IAM instance role
 * provides them automatically via IMDSv2. No AWS_ACCESS_KEY_ID or
 * AWS_SECRET_ACCESS_KEY anywhere in this file or in .env.
 */
import { config } from "dotenv";
config();

const required = [
  // Server
  "PORT",
  "FRONTEND_URL",
  "NODE_ENV",

  // Database
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",

  // JWT
  "JWT_SECRET",
  "STAFF_JWT_SECRET",

  // AWS S3 — credentials via EC2 instance role, not env vars
  "AWS_REGION",
  "S3_BUCKET",

  // CloudFront distribution domain that fronts the private S3 bucket for
  // publicly-readable product/category images (see §10 of the API plan)
  "CDN_DOMAIN",

  // VNPay
  "VNPAY_TMN_CODE",
  "VNPAY_HASH_SECRET",
  "VNPAY_RETURN_URL",
  "VNPAY_IPN_URL",

  // GHN
  "GHN_API_URL",
  "GHN_API_TOKEN",
  "GHN_SHOP_ID",
  "GHN_FROM_DISTRICT",
  "GHN_FROM_WARD",

  // TODO: Remove to test without Try-on
  // "TRYON_API_KEY",
  // "TRYON_BASE_URL",

  // NOTE: FIREBASE_* and SMTP_* are deliberately NOT in this required list.
  // They only back the "forgot password" feature (config/firebase.ts,
  // config/mailer.ts) — the rest of the app must still boot without them.
  // Calling forgot-password without them configured throws a clear 500
  // instead of crashing the whole process at startup.
] as const;

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `[env] Missing required environment variables:\n  ${missing.join("\n  ")}`,
  );
  process.exit(1);
}

export const env = {
  PORT: parseInt(process.env["PORT"] ?? "3000", 10),
  FRONTEND_URL: process.env["FRONTEND_URL"]!,
  NODE_ENV: process.env["NODE_ENV"]!,

  DB_HOST: process.env["DB_HOST"]!,
  DB_PORT: process.env["DB_PORT"]!,
  DB_USER: process.env["DB_USER"]!,
  DB_PASSWORD: process.env["DB_PASSWORD"]!,
  DB_NAME: process.env["DB_NAME"]!,

  JWT_SECRET: process.env["JWT_SECRET"]!,
  STAFF_JWT_SECRET: process.env["STAFF_JWT_SECRET"]!,

  // No AWS keys — instance role only
  AWS_REGION: process.env["AWS_REGION"]!,
  S3_BUCKET: process.env["S3_BUCKET"]!,
  CDN_DOMAIN: process.env["CDN_DOMAIN"]!,

  VNPAY_TMN_CODE: process.env["VNPAY_TMN_CODE"]!,
  VNPAY_HASH_SECRET: process.env["VNPAY_HASH_SECRET"]!,
  VNPAY_RETURN_URL: process.env["VNPAY_RETURN_URL"]!,
  VNPAY_IPN_URL: process.env["VNPAY_IPN_URL"]!,

  GHN_API_URL: process.env["GHN_API_URL"]!,
  GHN_API_TOKEN: process.env["GHN_API_TOKEN"]!,
  GHN_SHOP_ID: process.env["GHN_SHOP_ID"]!,
  GHN_FROM_DISTRICT: process.env["GHN_FROM_DISTRICT"]!,
  GHN_FROM_WARD: process.env["GHN_FROM_WARD"]!,

  // TODO: Remove these two env vars to test MVP
  // TRYON_API_KEY: process.env["TRYON_API_KEY"]!,
  // TRYON_BASE_URL: process.env["TRYON_BASE_URL"]!,

  // ─── Firebase (forgot-password only — optional, see note above) ───────────
  FIREBASE_PROJECT_ID: process.env["FIREBASE_PROJECT_ID"],
  FIREBASE_CLIENT_EMAIL: process.env["FIREBASE_CLIENT_EMAIL"],
  FIREBASE_PRIVATE_KEY: process.env["FIREBASE_PRIVATE_KEY"],
  // Web API key (public by design — same one used by Firebase JS SDKs).
  // Used server-side to call the Identity Toolkit REST API directly, so
  // we never need a Firebase client SDK in the browser at all.
  FIREBASE_WEB_API_KEY: process.env["FIREBASE_WEB_API_KEY"],

  // ─── SMTP (forgot-password only — optional, see note above) ────────────────
  SMTP_HOST: process.env["SMTP_HOST"],
  SMTP_PORT: process.env["SMTP_PORT"],
  SMTP_USER: process.env["SMTP_USER"],
  SMTP_PASS: process.env["SMTP_PASS"],
  SMTP_FROM: process.env["SMTP_FROM"],
} as const;
