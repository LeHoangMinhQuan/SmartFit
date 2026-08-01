/**
 * services/rpm-limiter.service.ts
 *
 * App-wide requests-per-minute gate, keyed by model, enforced BEFORE a
 * call is allowed to go out to Gemini. See config/env.ts's GEMINI_*_RPM
 * comment for why this is needed in addition to the daily budget in
 * gemini_usage_counter and separate from middleware/rateLimiter.ts's
 * chatLimiter (that one throttles a single user; this one protects the
 * shared per-project Gemini RPM quota across every user at once).
 *
 * In-memory, not DB-backed — deliberately. RPM is a 60-second rolling
 * window, so unlike the daily budget (which must survive a restart, see
 * model-usage.model.ts) losing an in-memory RPM window on deploy/restart
 * only ever costs up to one minute of imprecision, and a DB round-trip on
 * every single chat/embedding call just to track a per-minute counter
 * would be its own latency and connection-pool cost for no real benefit
 * at this project's scale.
 *
 * Caveat if this ever runs as more than one server process/replica
 * (e.g. multiple EKS pods behind a load balancer): each process would
 * enforce its own independent RPM window, so the real aggregate RPM
 * hitting Gemini could exceed the configured limit by up to (replica
 * count)x. Fine for a single-instance deploy; move this to a shared
 * store (Redis INCR + EXPIRE, or similar) before scaling out horizontally.
 */

const WINDOW_MS = 60_000;

const requestTimestamps = new Map<string, number[]>();

function prune(model: string, now: number): number[] {
  const existing = requestTimestamps.get(model) ?? [];
  const fresh = existing.filter((t) => now - t < WINDOW_MS);
  requestTimestamps.set(model, fresh);
  return fresh;
}

/**
 * Attempts to reserve one RPM slot for `model` against `limit`. Returns
 * true (and records the slot) if under the limit, false otherwise.
 * Synchronous and non-yielding — Node's single-threaded event loop means
 * there's no await between the prune/check/push below, so this can't
 * race with itself across concurrent requests the way the old DB
 * check-then-increment could.
 */
export function tryConsume(model: string, limit: number): boolean {
  const now = Date.now();
  const fresh = prune(model, now);
  if (fresh.length >= limit) return false;
  fresh.push(now);
  return true;
}

/**
 * Releases the most recently reserved slot for `model` — used when a
 * tryConsume() succeeded but the call it was reserved for ended up not
 * being made after all (e.g. RPM had room but the daily budget didn't,
 * see gemini-budget.service.ts). Not used for refunding failed calls
 * that WERE actually sent to Gemini — see that file's doc comment for why.
 */
export function release(model: string): void {
  const fresh = requestTimestamps.get(model);
  if (fresh && fresh.length) fresh.pop();
}

/** Current in-window request count for a model — for logging/debugging. */
export function currentCount(model: string): number {
  return prune(model, Date.now()).length;
}
