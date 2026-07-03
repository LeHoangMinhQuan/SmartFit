import fetch from "node-fetch";
import { writeFileSync } from "fs";
import { config } from "dotenv";

config();

// ── CONFIG ───────────────────────────────────────────────────────────────────
const BASE_URL = process.env.GHN_API_URL; // e.g. https://dev-online-gateway.ghn.vn/shiip/public-api/master-data
const TOKEN = process.env.BASE_URLTOKEN;
const OUTPUT = "sql/ghn_locations_seed.sql";
// ─────────────────────────────────────────────────────────────────────────────

if (!BASE_URL) throw new Error("Missing GHN_API_URL in .env");
if (!TOKEN) throw new Error("Missing GHN_API_TOKEN in .env");

// ── HELPERS ──────────────────────────────────────────────────────────────────
function esc(value) {
  return String(value).replace(/'/g, "''");
}

function bool(value) {
  return value ? "TRUE" : "FALSE";
}

async function ghnGet(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Token: TOKEN, "Content-Type": "application/json" },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);

  const body = await res.json();
  if (body.code !== 200)
    throw new Error(`GHN error on ${path}: ${body.message}`);

  return body.data;
}

// ── TRANSFORM ────────────────────────────────────────────────────────────────
function transformProvinces(data) {
  const valid = [],
    skipped = [];

  for (const p of data) {
    const name = p.ProvinceName ?? "";
    const code = p.Code ?? "";
    const id = p.ProvinceID;

    if (name.length > 20) {
      skipped.push({
        id,
        name,
        reason: `name length ${name.length} > 20 (test data)`,
      });
      continue;
    }
    if (!code) {
      skipped.push({ id, name, reason: "missing Code" });
      continue;
    }

    valid.push({
      province_id: id,
      province_name: name,
      province_code: code,
      canupdatecod: p.CanUpdateCOD ?? true,
      status: p.Status ?? 1,
    });
  }

  return { valid, skipped };
}

function transformDistricts(data) {
  const valid = [],
    skipped = [];

  for (const d of data) {
    const name = d.DistrictName ?? "";
    const code = d.Code ?? "";
    const id = d.DistrictID;

    if (!code) {
      skipped.push({ id, name, reason: "missing Code" });
      continue;
    }

    valid.push({
      district_id: id,
      province_id: d.ProvinceID,
      district_name: name,
      district_code: code,
      canupdatecod: d.CanUpdateCOD ?? true,
      status: d.Status ?? 1,
      supporttype: d.SupportType ?? 3,
    });
  }

  return { valid, skipped };
}

function transformWards(data) {
  const valid = [],
    skipped = [];

  for (const w of data) {
    const name = w.WardName ?? "";
    const wardId = parseInt(w.WardCode, 10);

    if (isNaN(wardId)) {
      skipped.push({
        wardCode: w.WardCode,
        name,
        reason: `WardCode "${w.WardCode}" cannot be parsed to INT`,
      });
      continue;
    }

    if (wardId == 1) {
      skipped.push({
        wardCode: w.WardCode,
        name,
        reason: `WardCode "${w.WardCode}" is invalid (have multiple entries with same code, need provider update)`,
      });
      continue;
    }

    valid.push({
      ward_id: wardId,
      ward_name: name,
      district_id: w.DistrictID,
      canupdatecod: w.CanUpdateCOD ?? true,
      status: w.Status ?? 1,
      supporttype: w.SupportType ?? 3,
    });
  }

  return { valid, skipped };
}

// ── SQL GENERATORS ───────────────────────────────────────────────────────────
function provinceSQL(records) {
  const values = records
    .map(
      (r) =>
        `    (${r.province_id}, '${esc(r.province_name)}', '${esc(r.province_code)}', ${bool(r.canupdatecod)}, ${r.status})`,
    )
    .join(",\n");

  return [
    "-- PROVINCE",
    'INSERT INTO province (province_id, province_name, province_code, "canupdatecod", status)',
    "VALUES",
    `${values};`,
  ].join("\n");
}

function districtSQL(records) {
  const values = records
    .map(
      (r) =>
        `    (${r.district_id}, ${r.province_id}, '${esc(r.district_name)}', '${esc(r.district_code)}', ${bool(r.canupdatecod)}, ${r.status}, ${r.supporttype})`,
    )
    .join(",\n");

  return [
    "-- DISTRICT",
    'INSERT INTO district (district_id, province_id, district_name, district_code, "canupdatecod", status, "supporttype")',
    "VALUES",
    `${values};`,
  ].join("\n");
}

function wardSQL(records) {
  const values = records
    .map(
      (r) =>
        `    (${r.ward_id}, '${esc(r.ward_name)}', ${r.district_id}, ${bool(r.canupdatecod)}, ${r.status}, ${r.supporttype})`,
    )
    .join(",\n");

  return [
    "-- WARD",
    'INSERT INTO ward (ward_id, ward_name, district_id, "canupdatecod", status, "supporttype")',
    "VALUES",
    `${values};`,
  ].join("\n");
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const lines = [
    "-- ============================================================",
    "-- GHN location seed — province → district → ward",
    "-- Generated: " + new Date().toISOString(),
    "-- ============================================================",
    "",
  ];

  // 1. Provinces
  console.log("Fetching provinces...");
  const rawProvinces = await ghnGet("/province");
  const { valid: provinces, skipped: skippedP } =
    transformProvinces(rawProvinces);
  console.log(`  → ${provinces.length} valid, ${skippedP.length} skipped`);
  if (skippedP.length)
    skippedP.forEach((s) =>
      console.log(`     SKIP province [${s.id}] "${s.name}" — ${s.reason}`),
    );

  lines.push(provinceSQL(provinces), "");

  // 2. Districts (fetch per province)
  console.log("Fetching districts...");
  let allDistricts = [],
    allSkippedD = [];

  for (const p of provinces) {
    const raw = await ghnGet("/district", { province_id: p.province_id });
    const { valid, skipped } = transformDistricts(raw ?? []);
    allDistricts.push(...valid);
    allSkippedD.push(...skipped);
  }

  console.log(
    `  → ${allDistricts.length} valid, ${allSkippedD.length} skipped`,
  );
  if (allSkippedD.length)
    allSkippedD.forEach((s) =>
      console.log(`     SKIP district [${s.id}] "${s.name}" — ${s.reason}`),
    );

  lines.push(districtSQL(allDistricts), "");

  // 3. Wards (fetch per district)
  console.log("Fetching wards...");
  let allWards = [],
    allSkippedW = [];

  for (const d of allDistricts) {
    const raw = await ghnGet("/ward", { district_id: d.district_id });
    const { valid, skipped } = transformWards(raw ?? []);
    allWards.push(...valid);
    allSkippedW.push(...skipped);
  }

  console.log(`  → ${allWards.length} valid, ${allSkippedW.length} skipped`);
  if (allSkippedW.length)
    allSkippedW.forEach((s) =>
      console.log(`     SKIP ward [${s.wardCode}] "${s.name}" — ${s.reason}`),
    );

  lines.push(wardSQL(allWards), "");

  // Write output
  writeFileSync(OUTPUT, lines.join("\n"), "utf-8");

  console.log(`\nDone. SQL written to: ${OUTPUT}`);
  console.log(`Run with:`);
  console.log(`  psql -U <user> -d <database> -f ${OUTPUT}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
