/**
 * config/tryon.ts
 *
 * Holds the CURRENT Kaggle/CatVTON inference endpoint. This is deliberately
 * an in-memory singleton, not an .env var and not a DB row — the ngrok/
 * cloudflared URL changes every time the Kaggle notebook (re)starts, so
 * baking it into a static config would go stale within hours.
 *
 * Updated via PUT /api/admin/tryon/endpoint. Resets on server restart,
 * which is fine: the Kaggle notebook needs to be re-registered after any
 * restart anyway (its URL changed too).
 *
 * If this backend ever runs multiple instances, move this into Redis or a
 * one-row settings table — an in-memory singleton won't be shared across
 * processes.
 */

export type TryonFailureReason =
  | 'endpoint_not_registered'
  | 'endpoint_offline'
  | 'inference_error'
  | 'timeout';

export interface TryonEndpointConfig {
  base_url: string | null;
  shared_secret: string | null;
  last_health_check_at: Date | null;
  last_health_check_ok: boolean;
}

let current: TryonEndpointConfig = {
  base_url: null,
  shared_secret: null,
  last_health_check_at: null,
  last_health_check_ok: false,
};

/** Register (or rotate) the current Kaggle tunnel URL + shared secret. */
export function setEndpoint(base_url: string, shared_secret: string): void {
  current = {
    base_url: base_url.replace(/\/+$/, ''), // strip trailing slash
    shared_secret,
    last_health_check_at: null,
    last_health_check_ok: false,
  };
}

export function getEndpoint(): TryonEndpointConfig {
  return current;
}

/** Called after every /health probe (registration-time or inference-time). */
export function recordHealthCheck(ok: boolean): void {
  current = { ...current, last_health_check_at: new Date(), last_health_check_ok: ok };
}

export const tryonConstants = {
  S3_PREFIX: 'tryon-sessions',
  MAX_PHOTO_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  HEALTH_CHECK_TIMEOUT_MS: 5000,
  INFERENCE_TIMEOUT_MS: 90_000, // CatVTON diffusion inference + queue wait
};
