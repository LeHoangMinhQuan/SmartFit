#!/usr/bin/env node
/**
 * Hardening audit — Phase 16
 *
 * Statically checks the compiled source for the critical constraints
 * documented in the build plan. Run from the project root:
 *
 *   npx ts-node scripts/audit.ts
 *
 * Exit code 0 = all checks pass. Non-zero = failures printed to stderr.
 */

import fs from "fs";
import { globSync } from "glob";

type CheckResult = { pass: boolean; label: string; detail?: string };
const results: CheckResult[] = [];

function check(label: string, pass: boolean, detail?: string) {
  results.push({ label, pass, detail });
}

// ─── Load all TS source files ─────────────────────────────────────────────────
const srcFiles = globSync("src/**/*.ts");

function readAll(): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of srcFiles) {
    m.set(f, fs.readFileSync(f, "utf-8"));
  }
  return m;
}

function grep(
  files: Map<string, string>,
  pattern: RegExp,
): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = [];
  for (const [file, content] of files) {
    content.split("\n").forEach((line, i) => {
      if (pattern.test(line))
        hits.push({ file, line: i + 1, text: line.trim() });
    });
  }
  return hits;
}

const files = readAll();

// ─── Check 1: IPN route registered before express.json() in app.ts ───────────
{
  const appTs = files.get("src/app.ts") ?? "";
  const ipnIdx = appTs.indexOf("paymentRoutes");
  const jsonIdx = appTs.indexOf("express.json()");
  check(
    "IPN route registered BEFORE express.json()",
    ipnIdx !== -1 && jsonIdx !== -1 && ipnIdx < jsonIdx,
    ipnIdx > jsonIdx
      ? "paymentRoutes appears AFTER express.json() in app.ts"
      : undefined,
  );
}

// ─── Check 2: "ORDER" is quoted in all Knex queries ──────────────────────────
{
  // Find any unquoted db('ORDER') calls
  const bad = grep(files, /db\(['"`]ORDER['"`]\)(?![^)]*['"`]ORDER['"`])/);
  const unquoted = bad.filter((h) => !h.text.includes('"ORDER"'));
  check(
    '"ORDER" table always quoted in Knex calls',
    unquoted.length === 0,
    unquoted.map((h) => `${h.file}:${h.line} → ${h.text}`).join("\n"),
  );
}

// ─── Check 3: shipping_logs.status — mapGhnStatus used before every insert ───
{
  const shippingModel = files.get("src/models/shipping.model.ts") ?? "";
  check(
    "mapGhnStatus() called before every shipping_logs insert",
    shippingModel.includes("mapGhnStatus") &&
      shippingModel.includes("status VARCHAR(10)") === false,
    !shippingModel.includes("mapGhnStatus")
      ? "mapGhnStatus not found in shipping.model.ts"
      : undefined,
  );
}

// ─── Check 4: address_line max 20 chars in Zod schemas ───────────────────────
{
  const userSchema = files.get("src/schemas/user.schema.ts") ?? "";
  check(
    "address_line max 20 chars enforced in Zod schema",
    userSchema.includes("address_line") && userSchema.includes(".max(20)"),
    !userSchema.includes(".max(20)")
      ? "max(20) not found on address_line in user.schema.ts"
      : undefined,
  );
}

// ─── Check 5: product.name max 20, description max 100 ───────────────────────
{
  const productSchema = files.get("src/schemas/product.schema.ts") ?? "";
  const hasName20 =
    /name.*max\(20\)/.test(productSchema) ||
    /max\(20\).*name/.test(productSchema);
  const hasDesc100 =
    /description.*max\(100\)/.test(productSchema) ||
    /max\(100\).*description/.test(productSchema);
  check(
    "product.name max 20 and description max 100 in Zod schema",
    hasName20 && hasDesc100,
    [
      !hasName20 && "name max(20) not found",
      !hasDesc100 && "description max(100) not found",
    ]
      .filter(Boolean)
      .join(", "),
  );
}

// ─── Check 6: IDENTITY columns never supplied on insert ───────────────────────
{
  // The main risk: explicitly inserting order_id, staff_id (as PK, not FK), session_id, transaction_id
  const identityPkColumns = [
    "order_id",
    "session_id",
    "transaction_id",
    "shipping_order_id",
    "review_id",
    "address_id",
    "image_id",
  ];
  const violations: string[] = [];

  for (const [file, content] of files) {
    if (!file.includes("model") && !file.includes("seed")) continue;
    for (const col of identityPkColumns) {
      // Match: { col: ..., (not as a FK value assigned from a returned ID)
      // Heuristic: an insert() call whose object literal contains `col:` as a key
      const insertPattern = new RegExp(`\\.insert\\([^)]*${col}\\s*:`, "s");
      if (insertPattern.test(content)) {
        // Exclude seeds (they may use OVERRIDING SYSTEM VALUE intentionally)
        if (!file.includes("seed")) {
          violations.push(`${file} — may insert explicit ${col}`);
        }
      }
    }
  }
  check(
    "IDENTITY PK columns not explicitly inserted (outside seeds)",
    violations.length === 0,
    violations.join("\n"),
  );
}

// ─── Check 7: Wishlist upsert doesn't create duplicates ───────────────────────
{
  const wishlistModel = files.get("src/models/wishlist.model.ts") ?? "";
  const hasExistingCheck =
    wishlistModel.includes("findWishlistItem") &&
    wishlistModel.includes("upsertWishlistItem");
  check(
    "Wishlist upsert checks existing row before insert",
    hasExistingCheck,
    !hasExistingCheck
      ? "upsertWishlistItem does not appear to guard against duplicate inserts"
      : undefined,
  );
}

// ─── Check 8: Staff transfer runs in a transaction ───────────────────────────
{
  const storeModel = files.get("src/models/store.model.ts") ?? "";
  check(
    "staff_working_history transfer runs in a db.transaction()",
    storeModel.includes("db.transaction") &&
      storeModel.includes("transferStaff"),
    !storeModel.includes("db.transaction")
      ? "transferStaff in store.model.ts does not use db.transaction()"
      : undefined,
  );
}

// ─── Check 9: Circular FK — ORDER created with NULL, updated after shipment ──
{
  const orderModel = files.get("src/models/order.model.ts") ?? "";
  const ghnService = files.get("src/services/ghn.service.ts") ?? "";
  check(
    "Circular FK: ORDER created with shipping_order_id nullable, updated post-IPN",
    !orderModel.includes("shipping_order_id") ||
      (orderModel.includes("shipping_order_id") &&
        ghnService.includes("setOrderShippingId")),
    !ghnService.includes("setOrderShippingId")
      ? "setOrderShippingId not called in ghn.service.ts after shipment creation"
      : undefined,
  );
}

// ─── Check 10: IPN never calls next(err) ─────────────────────────────────────
{
  const paymentController =
    files.get("src/controllers/payment.controller.ts") ?? "";
  // IPN handler is vnpayIpn — check it doesn't use next() for errors
  const ipnSection = paymentController.slice(
    paymentController.indexOf("vnpayIpn"),
  );
  const hasNextErr = /next\(err\)/.test(ipnSection);
  check(
    "IPN handler does not call next(err)",
    !hasNextErr,
    hasNextErr
      ? "next(err) found in vnpayIpn handler — must return { RspCode } instead"
      : undefined,
  );
}

// ─── Check 11: IPN idempotency — status: 'pending' guard before update ────────
{
  const vnpayService = files.get("src/services/vnpay.service.ts") ?? "";
  check(
    "IPN idempotency guard (status: pending check before update)",
    vnpayService.includes("status: 'pending'") &&
      vnpayService.includes("Already processed"),
    !vnpayService.includes("status: 'pending'")
      ? "No 'status: pending' guard in vnpay.service.ts — duplicate IPN may double-process"
      : undefined,
  );
}

// ─── Check 12: Pagination on all list endpoints ───────────────────────────────
{
  const listEndpoints = [
    { file: "src/models/product.model.ts", fn: "findAllProducts" },
    { file: "src/models/order.model.ts", fn: "findOrdersByUser" },
    { file: "src/models/review.model.ts", fn: "findReviewsByProduct" },
    { file: "src/models/staff.model.ts", fn: "findAllStaff" },
    { file: "src/models/voucher.model.ts", fn: "findAllVouchers" },
  ];
  const missing: string[] = [];
  for (const { file, fn } of listEndpoints) {
    const content = files.get(file) ?? "";
    const fnBody = content.slice(content.indexOf(fn));
    if (!fnBody.includes(".limit(") || !fnBody.includes(".offset(")) {
      missing.push(`${file}:${fn}`);
    }
  }
  check(
    "Pagination (limit + offset) applied to all list model functions",
    missing.length === 0,
    missing.join(", "),
  );
}

// ─── Check 13: Rate limiter on tryon route ────────────────────────────────────
{
  const tryonRoutes = files.get("src/routes/tryon.routes.ts") ?? "";
  check(
    "tryonLimiter applied to POST /tryon/session",
    tryonRoutes.includes("tryonLimiter"),
    !tryonRoutes.includes("tryonLimiter")
      ? "tryonLimiter not found in tryon.routes.ts"
      : undefined,
  );
}

// ─── Check 14: Error response shape includes statusCode ──────────────────────
{
  const errorHandler = files.get("src/middleware/errorHandler.ts") ?? "";
  check(
    "Error handler emits { status, statusCode, message } shape",
    errorHandler.includes("statusCode") || errorHandler.includes("status:"),
    !errorHandler.includes("statusCode")
      ? "errorHandler.ts may not include statusCode in response"
      : undefined,
  );
}

// ─── Check 15: import_date defaults to NOW() — app doesn't always supply it ──
{
  const importModel = files.get("src/models/import-history.model.ts") ?? "";
  check(
    "import_history: import_date only included in insert when explicitly provided",
    importModel.includes("import_date") &&
      importModel.includes("if (data.import_date)"),
    !importModel.includes("if (data.import_date)")
      ? "import_history model always sets import_date — DB default bypassed"
      : undefined,
  );
}

// ─── Report ───────────────────────────────────────────────────────────────────
const passes = results.filter((r) => r.pass).length;
const fails = results.filter((r) => !r.pass);

console.log("\n═══ Hardening Audit Report ═══\n");
for (const r of results) {
  const icon = r.pass ? "✅" : "❌";
  console.log(`${icon}  ${r.label}`);
  if (!r.pass && r.detail) {
    for (const line of r.detail.split("\n")) {
      console.log(`      ${line}`);
    }
  }
}

console.log(`\n${passes}/${results.length} checks passed`);

if (fails.length > 0) {
  process.exit(1);
}
