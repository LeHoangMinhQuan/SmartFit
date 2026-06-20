/**
 * env.ts
 *
 * Validates all required environment variables at process startup.
 * Import this first in app.ts — if anything is missing the process exits
 * immediately with a clear message instead of failing silently at runtime.
 *
 * Access env values throughout the app via this module, not process.env directly,
 * so TypeScript knows every value is a defined string.
 */
import { config } from "dotenv";
config(); // load .env file into process.env
const required = [
  // TODO: Uncomment for testing
  // Database
  "PORT",
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",

  // // JWT — two separate secrets (§8: user vs staff tokens must not be cross-usable)
  // "JWT_SECRET",
  // "STAFF_JWT_SECRET",

  // // AWS S3 — used by upload.ts, tryonUpload.ts, and storage.service.ts
  // "AWS_REGION",
  // "AWS_ACCESS_KEY_ID",
  // "AWS_SECRET_ACCESS_KEY",
  // "S3_BUCKET",

  // // VNPay sandbox (§6)
  // "VNP_TMN_CODE",
  // "VNP_HASH_SECRET",
  // "VNP_RETURN_URL",

  // // GHN (§7)
  // "GHN_TOKEN",
  // "GHN_SHOP_ID",

  // // Virtual try-on AI provider (§5)
  // "TRYON_API_KEY",
  // "TRYON_API_URL",
] as const;

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `[env] Missing required environment variables:\n  ${missing.join("\n  ")}`,
  );
  process.exit(1);
}

// Export as typed constants — all values are guaranteed defined past this point
export const env = {
  // Server
  NODE_ENV: process.env["NODE_ENV"] ?? "development",
  PORT: parseInt(process.env["PORT"] ?? "3000", 10),

  // Database
  // DATABASE_URL: process.env["DATABASE_URL"]!,
  DB_HOST: process.env["DB_HOST"]!,
  DB_PORT: process.env["DB_PORT"]!,
  DB_USER: process.env["DB_USER"]!,
  DB_PASSWORD: process.env["DB_PASSWORD"]!,
  DB_NAME: process.env["DB_NAME"]!,

  // JWT
  JWT_SECRET: process.env["JWT_SECRET"]!,
  STAFF_JWT_SECRET: process.env["STAFF_JWT_SECRET"]!,

  // AWS / S3
  AWS_REGION: process.env["AWS_REGION"]!,
  AWS_ACCESS_KEY_ID: process.env["AWS_ACCESS_KEY_ID"]!,
  AWS_SECRET_ACCESS_KEY: process.env["AWS_SECRET_ACCESS_KEY"]!,
  S3_BUCKET: process.env["S3_BUCKET"]!,

  // VNPay
  VNP_TMN_CODE: process.env["VNP_TMN_CODE"]!,
  VNP_HASH_SECRET: process.env["VNP_HASH_SECRET"]!,
  VNP_RETURN_URL: process.env["VNP_RETURN_URL"]!,

  // GHN
  GHN_TOKEN: process.env["GHN_TOKEN"]!,
  GHN_SHOP_ID: process.env["GHN_SHOP_ID"]!,

  // Try-on
  TRYON_API_KEY: process.env["TRYON_API_KEY"]!,
  TRYON_API_URL: process.env["TRYON_API_URL"]!,
} as const;
