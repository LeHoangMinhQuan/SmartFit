/**
 * services/gemini-budget.service.ts
 *
 * Single choke point for "am I allowed to make this Gemini call right
 * now" — combines the in-process RPM gate (rpm-limiter.service.ts) with
 * the persisted daily budget (models/model-usage.model.ts) into one
 * reserve/refund API, shared by model-router.service.ts (chat models)
 * and retrieval/embedding.service.ts (embedding model) so all three
 * Gemini call sites in this codebase go through the same accounting
 * instead of each reimplementing it slightly differently.
 */
import * as ModelUsageModel from "../models/model-usage.model.js";
import * as RpmLimiter from "./rpm-limiter.service.js";

export type ReserveFailureReason = "rpm" | "daily_budget";

export interface BudgetReservation {
  model: string;
}

export type ReserveResult =
  | { ok: true; reservation: BudgetReservation }
  | { ok: false; reason: ReserveFailureReason };

/**
 * Attempts to reserve one call's worth of budget for `model`, checking
 * the RPM ceiling first (cheap, in-memory, no DB round-trip) and only
 * then the daily budget (atomic DB upsert — see tryIncrement's doc
 * comment for why this is race-free where the old code wasn't).
 *
 * If RPM passes but the daily budget doesn't, the RPM slot we
 * provisionally took is released — it shouldn't count against the
 * per-minute window since no request is actually going out to Gemini
 * for it.
 */
export async function tryReserve(
  model: string,
  dailyBudget: number,
  rpmLimit: number,
): Promise<ReserveResult> {
  if (!RpmLimiter.tryConsume(model, rpmLimit)) {
    console.warn("[gemini-budget] RPM cap reached", {
      model,
      rpmLimit,
      currentCount: RpmLimiter.currentCount(model),
    });
    return { ok: false, reason: "rpm" };
  }

  const count = await ModelUsageModel.tryIncrement(model, dailyBudget);
  if (count === null) {
    RpmLimiter.release(model);
    console.warn("[gemini-budget] daily budget exhausted", {
      model,
      dailyBudget,
    });
    return { ok: false, reason: "daily_budget" };
  }

  return { ok: true, reservation: { model } };
}

/**
 * Call once the actual Gemini request tied to `reservation` has failed
 * (thrown exception, error response, aborted stream) — refunds the daily
 * budget slot so a call that produced nothing doesn't permanently count
 * against today's total.
 *
 * Deliberately does NOT release an RPM slot here — unlike the daily
 * budget, the RPM window reflects requests that were actually sent
 * within that minute regardless of outcome (that's what Gemini's own RPM
 * enforcement counts too), and the window self-clears within 60s anyway,
 * so there's no long-lived harm in leaving it consumed.
 */
export async function refund(reservation: BudgetReservation): Promise<void> {
  try {
    await ModelUsageModel.decrement(reservation.model);
  } catch (err) {
    // A failed refund just means today's count runs slightly high for
    // this model — not worth failing the request over at this point,
    // the response has likely already been sent to the client.
    console.error(
      "[gemini-budget] failed to refund budget after call failure",
      { model: reservation.model, err },
    );
  }
}
