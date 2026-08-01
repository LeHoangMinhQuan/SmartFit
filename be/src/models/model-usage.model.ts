/**
 * models/model-usage.model.ts
 *
 * Backs services/model-router.service.ts. One row per (model, day),
 * incremented once per Gemini call so the router can enforce a daily
 * free-tier budget per model. Persisted rather than in-memory so a server
 * restart mid-day doesn't lose the count — see the gemini_usage_counter
 * comment in sql/LVTN(psql).sql for the full rationale.
 */
import db from "../config/db.js";

const TABLE = "gemini_usage_counter";

/** Today's request count for a model. 0 if no row exists yet today. */
export async function getTodayCount(model: string): Promise<number> {
  const row = await db(TABLE)
    .where({ model, usage_date: db.raw("CURRENT_DATE") })
    .first("request_count");
  return row?.request_count ?? 0;
}

/**
 * Atomically increments today's count for a model and returns the new
 * total. Uses INSERT ... ON CONFLICT rather than a separate
 * check-then-write so concurrent requests can't both read the same
 * pre-increment count — the trade-off is this can only be called once the
 * router has already decided to use this model, not as a dry-run check
 * (see model-router.service.ts's check-then-increment ordering, which
 * accepts a small race window in exchange for being able to *decide*
 * off a count before committing to it — acceptable at this project's
 * traffic scale).
 */
export async function incrementAndGetCount(model: string): Promise<number> {
  const [row] = await db
    .raw(
      `
    INSERT INTO ${TABLE} (model, usage_date, request_count)
    VALUES (?, CURRENT_DATE, 1)
    ON CONFLICT (model, usage_date) DO UPDATE
      SET request_count = ${TABLE}.request_count + 1
    RETURNING request_count
    `,
      [model],
    )
    .then((r) => r.rows);
  return row.request_count;
}
