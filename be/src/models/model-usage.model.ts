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
 * Atomically reserves one call's worth of budget: increments today's
 * count for `model` and returns the new total, but ONLY if doing so
 * wouldn't exceed `budget`. Returns null if the budget is already spent.
 *
 * This replaces the old check-then-increment pattern (a separate
 * getTodayCount() read followed by a separate incrementAndGetCount()
 * write), which had a real race window: two concurrent requests could
 * both read count=budget-1, both decide "there's room", and both
 * increment — landing one request over budget. The window is small but
 * not theoretical; a user double-clicking send, or two browser tabs, is
 * enough to hit it.
 *
 * The fix is a single INSERT ... ON CONFLICT DO UPDATE ... WHERE
 * statement. Postgres takes a row-level lock on the (model, usage_date)
 * conflict target as part of resolving the upsert, so concurrent callers
 * targeting the same row serialize against each other even under the
 * default READ COMMITTED isolation — there's no separate read step for a
 * second transaction to race into. Only one of two simultaneous callers
 * at the budget boundary can ever get a non-null result back.
 *
 * Edge case worth knowing: the WHERE guard only applies to the UPDATE
 * branch of the upsert (i.e. once a row already exists for today). The
 * very first call for a (model, day) always inserts count=1 regardless
 * of `budget`, so a budget of 0 wouldn't actually block that first call.
 * Not a real concern at any budget >= 1, which is the only sane
 * configuration, but worth knowing if you ever set a budget to 0 to
 * "disable" a model — use a feature flag for that instead.
 */
export async function tryIncrement(
  model: string,
  budget: number,
): Promise<number | null> {
  const rows = await db
    .raw(
      `
    INSERT INTO ${TABLE} (model, usage_date, request_count)
    VALUES (?, CURRENT_DATE, 1)
    ON CONFLICT (model, usage_date) DO UPDATE
      SET request_count = ${TABLE}.request_count + 1
      WHERE ${TABLE}.request_count < ?
    RETURNING request_count
    `,
      [model, budget],
    )
    .then((r) => r.rows);
  return rows[0]?.request_count ?? null;
}

/**
 * Refunds one call's worth of budget after a Gemini call that was
 * reserved via tryIncrement() ultimately failed (network error, provider
 * error response, thrown exception before any usable output) — so a
 * failed call doesn't permanently eat into today's budget for a request
 * that produced nothing. Not called on success. Clamped at 0 so a
 * refund can never push the counter negative (e.g. if this were ever
 * called twice for the same reservation by mistake).
 */
export async function decrement(model: string): Promise<void> {
  await db.raw(
    `
    UPDATE ${TABLE}
    SET request_count = GREATEST(request_count - 1, 0)
    WHERE model = ? AND usage_date = CURRENT_DATE
    `,
    [model],
  );
}
