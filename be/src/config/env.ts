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
  // Shared secret between the Next.js server (app/api/sync-google-user)
  // and this backend's POST /api/app-auth/google-sync — see that route's
  // doc comment for why this endpoint can't be left open to any caller.
  "GOOGLE_SYNC_SECRET",
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
  "GHN_WEBHOOK_SECRET",

  // Gemini (AI shopping assistant — chat + embeddings)
  "GEMINI_API_KEY",
] as const;

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `[env] Missing required environment variables:\n  ${missing.join("\n  ")}`,
  );
  process.exit(1);
}

/**
 * A present-but-blank env var (e.g. a bare `GEMINI_CHAT_MODEL=` line in
 * .env/docker-compose, or a Compose `environment:` block referencing an
 * unset host variable, which Compose resolves to "" rather than omitting
 * the key) is NOT the same as an unset one — `??` only falls back on
 * null/undefined, so "" sails through unchanged. This bit this codebase
 * twice already: once on GEMINI_CHAT_MODEL/GEMINI_EMBEDDING_MODEL
 * (google('') -> LoadAPIKeyError-adjacent silent failure), and again on
 * the model-router's budget/RPM numbers, where Number("") evaluates to
 * 0 — not NaN — silently zeroing out every daily budget and RPM ceiling,
 * so every single Gemini call (including every search_products embedding
 * call) gets rejected by gemini-budget.service.ts's reservation check
 * before it ever reaches Google. That's the actual root cause of the
 * "chatbot always says no products found" bug: it's not a search bug,
 * it's every embedding call failing the budget check 100% of the time.
 */
function envString(key: string, fallback: string): string {
  const raw = process.env[key];
  return raw && raw.trim() !== "" ? raw : fallback;
}

function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  PORT: parseInt(process.env["PORT"] ?? "3000", 10),
  FRONTEND_URL: process.env["FRONTEND_URL"]!,
  GOOGLE_SYNC_SECRET: process.env["GOOGLE_SYNC_SECRET"]!,
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
  // GHN's webhook payloads aren't HMAC-signed the way VNPay's IPN is —
  // there's no shared-secret checksum GHN computes for you to verify.
  // The practical mitigation used here (and by most real GHN
  // integrations): register a URL containing this secret as the
  // "Callback URL" in GHN's shop settings
  // (https://.../api/shipping/webhook/<this value>), and reject any
  // request that doesn't have it — see shipping.controller.ts's
  // ghnWebhook. Without this, the route comment claiming "verified by
  // GHN token" was aspirational — nothing actually checked anything, so
  // anyone who found the endpoint could POST fake delivery statuses for
  // any order.
  GHN_WEBHOOK_SECRET: process.env["GHN_WEBHOOK_SECRET"]!,

  // Gemini
  GEMINI_API_KEY: process.env["GEMINI_API_KEY"]!,
  // Default and heavy task model
  GEMINI_CHAT_MODEL: envString("GEMINI_CHAT_MODEL", "gemini-3.6-flash"),
  GEMINI_EMBEDDING_MODEL: envString(
    "GEMINI_EMBEDDING_MODEL",
    "gemini-embedding-2",
  ),
  // Lite model for low-cost tasks or budget fallbacks.
  //
  // FIX: default here was "gemini-3.1-flash-lite", which Google
  // deprecated 2026-05-11 and fully shut down 2026-05-25 — confirmed via
  // the Gemini API's own changelog (ai.google.dev/gemini-api/docs/changelog).
  // That's before today, so every call to it 404s outright. Since
  // model-router.service.ts's classifyComplexity defaults to "light" for
  // most single-intent product searches (anything that isn't cart-intent,
  // comparison/reasoning language, a resolved anaphoric reference, or
  // unusually long), THIS — not the budget-zeroing bug fixed above — may
  // be why searches were failing: whichever bug your deployment actually
  // hit first, both independently guaranteed 100% failure on ordinary
  // "find me X" turns. Correct current lite-tier model is
  // gemini-3.5-flash-lite (GA since 2026-07-21, alongside gemini-3.6-flash).
  GEMINI_CHAT_MODEL_LITE: envString(
    "GEMINI_CHAT_MODEL_LITE",
    "gemini-3.5-flash-lite",
  ),

  GEMINI_HEAVY_DAILY_BUDGET: envNumber("GEMINI_HEAVY_DAILY_BUDGET", 1000),
  GEMINI_LITE_DAILY_BUDGET: envNumber("GEMINI_LITE_DAILY_BUDGET", 1200),
  // Embedding calls were previously untracked entirely — every
  // search_products turn (retrieval.service.ts) and every admin reindex
  // (embedding.service.ts) hit Gemini with zero budget accounting, so
  // this could silently burn the embedding model's free-tier quota (and
  // starve retrieval mid-day) without ever showing up in
  // gemini_usage_counter. Conservative default; see the RPM note below —
  // free-tier numbers drift over time and Google doesn't publish a
  // stable public table, so these are a floor, not a guarantee.
  GEMINI_EMBEDDING_DAILY_BUDGET: envNumber(
    "GEMINI_EMBEDDING_DAILY_BUDGET",
    1000,
  ),

  // Requests-per-minute ceilings, enforced in-process by
  // rpm-limiter.service.ts BEFORE a call ever reaches Gemini. This is
  // separate from (and in addition to) the daily budgets above — RPM is
  // what actually throws a live 429 mid-conversation if too many users
  // hit the chatbot in the same 60s window, since the free tier's
  // per-model RPM cap applies across ALL users of this app (they all
  // share one GEMINI_API_KEY / one Google Cloud project), not per user.
  // middleware/rateLimiter.ts's chatLimiter (15 msgs/10min/user) does NOT
  // protect against this — it throttles a single user's spam, but many
  // different users each under that per-user limit can still collectively
  // blow through the shared per-minute Gemini quota.
  //
  // ⚠️ Verify these against your own project's live numbers at
  // https://aistudio.google.com/rate-limit before relying on them —
  // Google's published free-tier RPM/RPD figures for Flash-tier models
  // have changed multiple times through 2025-2026 and aren't reliably
  // documented in one place; the AI Studio page for YOUR project/key is
  // the only source of truth. These defaults are intentionally set below
  // every publicly-reported number we could find as a safety margin, not
  // as a claim about the exact real limit.
  GEMINI_HEAVY_RPM: envNumber("GEMINI_HEAVY_RPM", 8),
  GEMINI_LITE_RPM: envNumber("GEMINI_LITE_RPM", 12),
  GEMINI_EMBEDDING_RPM: envNumber("GEMINI_EMBEDDING_RPM", 8),

  // ─── Firebase (forgot-password only — optional, see note above) ───────────
  FIREBASE_PROJECT_ID: process.env["FIREBASE_PROJECT_ID"],
  FIREBASE_CLIENT_EMAIL: process.env["FIREBASE_CLIENT_EMAIL"],
  FIREBASE_WEB_API_KEY: process.env["FIREBASE_WEB_API_KEY"],
  FIREBASE_PRIVATE_KEY: process.env["FIREBASE_PRIVATE_KEY"],

  // ─── SMTP (forgot-password only — optional, see note above) ────────────────
  SMTP_HOST: process.env["SMTP_HOST"],
  SMTP_PORT: process.env["SMTP_PORT"],
  SMTP_USER: process.env["SMTP_USER"],
  SMTP_PASS: process.env["SMTP_PASS"],
  SMTP_FROM: process.env["SMTP_FROM"],
} as const;
