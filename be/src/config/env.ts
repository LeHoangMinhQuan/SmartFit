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

  // Updated 2026-08-03 from the actual live numbers on this project's
  // own https://aistudio.google.com Rate Limits page (no more guessing
  // from third-party trackers — see git history on this file for that
  // era). The dashboard lists two figures per metric, e.g. for
  // Gemini 3.6 Flash: RPM "7 / 5", TPM "15.98K / 250K", RPD "23 / 20".
  // The two figures are this model's OWN ceiling and the PROJECT-WIDE
  // shared-pool ceiling that applies across every Gemini model this key
  // calls (chat.ts's geminiProvider is one shared client/key for heavy +
  // lite + embedding) — and either ceiling can bind independently
  // (that's why RPD's second figure of 20 is the *lower* of the pair,
  // while TPM's second figure of 250K is the *higher* one — there's no
  // fixed direction; each is just whichever the dashboard reports).
  // Since both must hold simultaneously, the true usable budget per
  // model is min() of the two — so heavy Flash is really capped at 20
  // requests/day project-wide, not 23.
  //
  // This is drastically lower than this app's earlier assumed range
  // (~250-1,500 RPD) — free-tier Gemini access has clearly tightened
  // since those trackers were snapshotted. At 20 requests/day for the
  // heavy model, do NOT expect this to comfortably cover a 10-user demo
  // on heavy alone; model-router.service.ts's fallback-to-lite behavior
  // on heavy-budget exhaustion is now load-bearing, not just a nicety.
  // Re-check https://aistudio.google.com (Projects -> Rate Limits) for
  // your own key before a real demo — these figures can and do change.
  GEMINI_HEAVY_DAILY_BUDGET: envNumber("GEMINI_HEAVY_DAILY_BUDGET", 20),
  // Gemini 3.5 Flash Lite's dashboard row only reports RPM (see below);
  // RPD isn't shown for this model/tier, so there's no live number to
  // read off directly. Estimated by keeping the same heavy:lite ratio
  // this file used before (lite ran ~1.75x heavy) against the NEW heavy
  // figure (20) rather than the old one, which lands at 35. Treat this
  // one figure as an estimate, not a confirmed dashboard read — verify
  // it directly once RPD is visible for this model on your project.
  GEMINI_LITE_DAILY_BUDGET: envNumber("GEMINI_LITE_DAILY_BUDGET", 35),
  // Embedding model's RPD isn't broken out separately on the dashboard
  // either. Kept proportional to the previous heavy:embedding ratio
  // (1.25x) applied to the new heavy figure — same caveat as lite above,
  // confirm directly once visible. Every search_products turn
  // (retrieval.service.ts) costs one embedding call regardless of which
  // chat model handles the turn, so this scales with total conversation
  // volume, not with the heavy/lite split.
  GEMINI_EMBEDDING_DAILY_BUDGET: envNumber("GEMINI_EMBEDDING_DAILY_BUDGET", 25),

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
  // Read the same way as the RPD figures above (this model's own ceiling
  // vs. the project-wide pooled ceiling — take the smaller): heavy
  // Flash's dashboard row is "7 / 5" -> 5; lite's is "4 / 15" -> 4. Note
  // lite's pair reports the smaller number FIRST (unlike heavy's, where
  // it's second) — min() gives the same safe answer regardless of which
  // column is which, which is why this reads it that way rather than
  // assuming a fixed column order. Embedding model RPM isn't shown on
  // the dashboard at all; kept equal to the new heavy figure as a
  // conservative placeholder until you can confirm a real number.
  //
  // ⚠️ These came directly off this project's own AI Studio dashboard on
  // 2026-08-03, but Gemini free-tier limits have changed multiple times
  // through 2025-2026 — re-verify at https://aistudio.google.com/rate-limit
  // before a real demo rather than assuming these stay valid indefinitely.
  GEMINI_HEAVY_RPM: envNumber("GEMINI_HEAVY_RPM", 5),
  GEMINI_LITE_RPM: envNumber("GEMINI_LITE_RPM", 4),
  GEMINI_EMBEDDING_RPM: envNumber("GEMINI_EMBEDDING_RPM", 5),

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

  // ─── Order notifications (optional) ─────────────────────────────────────────
  // Where "new order ready for fulfillment" emails go — see
  // services/notification.service.ts. The `staff` table has no email
  // column at all (just staff_id/password_hash), so this is one shared
  // ops inbox rather than per-staff routing, same as many small real
  // shops actually do it. Soft-fails (logs + skips) if unset, same
  // pattern as SMTP/Firebase above — a missing notification must never
  // block order creation or payment confirmation.
  ORDER_NOTIFICATION_EMAIL: process.env["ORDER_NOTIFICATION_EMAIL"],
} as const;
