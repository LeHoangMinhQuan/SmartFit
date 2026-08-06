/**
 * models/user-heavy-usage.model.ts
 *
 * Per-user companion to model-usage.model.ts's gemini_usage_counter.
 * That table caps each Gemini model globally per day; this one caps how
 * much of the HEAVY model's tiny global budget (see config/env.ts,
 * GEMINI_HEAVY_DAILY_BUDGET) any single user can consume per day —
 * added because middleware/rateLimiter.ts's chatLimiter
 * (15 msgs/10min/user) throttles raw message volume but has no concept
 * of which messages are heavy-classified, so one user sending
 * cart/comparison-intent turns could otherwise consume most of the
 * day's global heavy budget alone before anyone else gets a turn.
 *
 * Deliberately NOT folded into gemini_usage_counter/tryIncrement — that
 * table's conflict target is (model, usage_date); this needs
 * (user_id, usage_date) instead. Backing table: sql/LVTN(psql).sql's
 * user_heavy_usage_counter, added alongside this file.
 *
 * Same CURRENT_DATE mechanism as model-usage.model.ts, so this shares
 * whatever day-boundary/timezone behavior that table has (known,
 * separately-tracked drift vs. Google's actual midnight-Pacific reset —
 * see config/env.ts's GEMINI_*_RPM comment).
 */
import db from "../config/db.js";

const TABLE = "user_heavy_usage_counter";

/** Today's heavy-tier request count for a user. 0 if no row exists yet today. */
export async function getTodayCount(userId: number): Promise<number> {
  const row = await db(TABLE)
    .where({ user_id: userId, usage_date: db.raw("CURRENT_DATE") })
    .first("request_count");
  return row?.request_count ?? 0;
}

/**
 * Atomically reserves one heavy-tier call's worth of this user's daily
 * cap. Same INSERT ... ON CONFLICT DO UPDATE ... WHERE shape as
 * model-usage.model.ts's tryIncrement — see that function's doc comment
 * for the race this avoids. Returns null if the user's cap is already
 * spent for today.
 *
 * Same first-call-always-inserts edge case as tryIncrement: a cap of 0
 * would not block a user's very first heavy call of the day. Not a real
 * concern at any cap >= 1.
 */
export async function tryIncrement(
  userId: number,
  cap: number,
): Promise<number | null> {
  const rows = await db
    .raw(
      `
    INSERT INTO ${TABLE} (user_id, usage_date, request_count)
    VALUES (?, CURRENT_DATE, 1)
    ON CONFLICT (user_id, usage_date) DO UPDATE
      SET request_count = ${TABLE}.request_count + 1
      WHERE ${TABLE}.request_count < ?
    RETURNING request_count
    `,
      [userId, cap],
    )
    .then((r) => r.rows);
  return rows[0]?.request_count ?? null;
}

/**
 * Refunds a user's heavy-tier reservation after the actual Gemini call
 * it was reserved for failed — mirrors model-usage.model.ts's decrement.
 * Called from the same failure path (chat.service.ts's streamText
 * onError) that already calls GeminiBudget.refund() for the model-level
 * counter, so a failed call never permanently costs the user part of
 * their daily allowance either. Clamped at 0.
 */
export async function decrement(userId: number): Promise<void> {
  await db.raw(
    `
    UPDATE ${TABLE}
    SET request_count = GREATEST(request_count - 1, 0)
    WHERE user_id = ? AND usage_date = CURRENT_DATE
    `,
    [userId],
  );
}
