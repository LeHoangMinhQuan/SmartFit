/**
 * config/tryon.ts
 *
 * Abstract client for the virtual try-on AI provider.
 * The service layer calls only `tryonClient.submitJob()` and
 * `tryonClient.getResult()` — swapping providers requires only
 * changing TRYON_PROVIDER in .env, nothing else.
 *
 * Supported providers:
 *   fashn     — Fashn.ai REST API  (https://api.fashn.ai)
 *   replicate — Replicate platform  (https://api.replicate.com)
 *   mock      — Returns a placeholder image; useful for local dev / tests
 *
 * TODO (before production):
 *   - Set TRYON_PROVIDER=fashn (or replicate) and add the API key to .env
 *   - Adjust category / garment_type to match your product taxonomy
 *   - Wire webhook callbacks from Replicate instead of polling (optional)
 */

import axios, { type AxiosInstance } from "axios";
import { env } from "./env.js";

// ── Shared types ──────────────────────────────────────────────────────────────

export type TryonJobStatus = "processing" | "ready" | "failed";

export interface TryonJobResult {
  jobId: string;
  status: TryonJobStatus;
  resultUrl?: string; // present when status === 'ready'
  error?: string; // present when status === 'failed'
}

/** Interface every provider implementation must satisfy */
export interface TryonProvider {
  /**
   * Submit a try-on job.
   * @param personImageUrl  Public URL of the user's uploaded photo
   * @param garmentImageUrl Public URL of the product variant's image
   * @returns jobId assigned by the provider
   */
  submitJob(personImageUrl: string, garmentImageUrl: string): Promise<string>;

  /**
   * Poll or fetch the result of a previously submitted job.
   */
  getResult(jobId: string): Promise<TryonJobResult>;
}

// ── Fashn.ai provider ─────────────────────────────────────────────────────────
//
// Docs: https://docs.fashn.ai
// Key required: FASHN_API_KEY

class FashnProvider implements TryonProvider {
  private readonly client: AxiosInstance;

  constructor() {
    if (!env.FASHN_API_KEY) {
      throw new Error("FASHN_API_KEY is required when TRYON_PROVIDER=fashn");
    }
    this.client = axios.create({
      baseURL: env.FASHN_BASE_URL,
      headers: {
        Authorization: `Bearer ${env.FASHN_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
  }

  async submitJob(
    personImageUrl: string,
    garmentImageUrl: string,
  ): Promise<string> {
    // TODO: adjust category / garment_type to match your product types
    const res = await this.client.post<{ id: string }>("/run", {
      model_image: personImageUrl,
      garment_image: garmentImageUrl,
      category: "tops", // TODO: derive from product attribute
    });
    return res.data.id;
  }

  async getResult(jobId: string): Promise<TryonJobResult> {
    const res = await this.client.get<{
      id: string;
      status: string;
      output?: string[];
      error?: string;
    }>(`/status/${jobId}`);

    const { status, output, error } = res.data;

    if (status === "completed" && output?.[0]) {
      return { jobId, status: "ready", resultUrl: output[0] };
    }
    if (status === "failed") {
      return { jobId, status: "failed", error: error ?? "Unknown error" };
    }
    return { jobId, status: "processing" };
  }
}

// ── Replicate provider (IDM-VTON) ─────────────────────────────────────────────
//
// Docs: https://replicate.com/yisol/idm-vton
// Key required: REPLICATE_API_KEY, REPLICATE_MODEL_VERSION

class ReplicateProvider implements TryonProvider {
  private readonly client: AxiosInstance;
  private readonly modelVersion: string;

  constructor() {
    if (!env.REPLICATE_API_KEY) {
      throw new Error(
        "REPLICATE_API_KEY is required when TRYON_PROVIDER=replicate",
      );
    }
    if (!env.REPLICATE_MODEL_VERSION) {
      throw new Error(
        "REPLICATE_MODEL_VERSION is required when TRYON_PROVIDER=replicate",
      );
    }
    this.modelVersion = env.REPLICATE_MODEL_VERSION;
    this.client = axios.create({
      baseURL: "https://api.replicate.com/v1",
      headers: {
        Authorization: `Bearer ${env.REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    });
  }

  async submitJob(
    personImageUrl: string,
    garmentImageUrl: string,
  ): Promise<string> {
    const res = await this.client.post<{ id: string }>("/predictions", {
      version: this.modelVersion,
      input: {
        human_img: personImageUrl,
        garm_img: garmentImageUrl,
        garment_des: "", // optional garment description
        is_checked: true,
        is_checked_crop: false,
        denoise_steps: 30,
        seed: 42,
      },
    });
    return res.data.id;
  }

  async getResult(jobId: string): Promise<TryonJobResult> {
    const res = await this.client.get<{
      id: string;
      status: string;
      output?: string | string[];
      error?: string;
    }>(`/predictions/${jobId}`);

    const { status, output, error } = res.data;

    if (status === "succeeded") {
      const url = Array.isArray(output) ? output[0] : output;
      if (!url) return { jobId, status: "failed", error: "No output returned" };
      return { jobId, status: "ready", resultUrl: url };
    }
    if (status === "failed" || status === "canceled") {
      return { jobId, status: "failed", error: error ?? "Prediction failed" };
    }
    return { jobId, status: "processing" };
  }
}

// ── Mock provider (local dev / tests) ─────────────────────────────────────────

class MockProvider implements TryonProvider {
  /** Simulates a 1-second async job then returns a placeholder image URL */
  async submitJob(_personUrl: string, _garmentUrl: string): Promise<string> {
    return `mock-job-${Date.now()}`;
  }

  async getResult(jobId: string): Promise<TryonJobResult> {
    // Always immediately "ready" in mock mode
    return {
      jobId,
      status: "ready",
      resultUrl: "https://placehold.co/600x800?text=Try-On+Preview",
    };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

function createTryonProvider(): TryonProvider {
  switch (env.TRYON_PROVIDER) {
    case "fashn":
      return new FashnProvider();
    case "replicate":
      return new ReplicateProvider();
    case "mock":
      return new MockProvider();
  }
}

/**
 * Singleton try-on provider client.
 * Import this in tryon.service.ts:
 *
 *   import { tryonClient } from './config/tryon.js';
 *   const jobId = await tryonClient.submitJob(personUrl, garmentUrl);
 */
export const tryonClient: TryonProvider = createTryonProvider();

// ── Session TTL ───────────────────────────────────────────────────────────────

/** Session lifetime in milliseconds (from TRYON_SESSION_TTL_SECONDS) */
export const TRYON_SESSION_TTL_MS = env.TRYON_SESSION_TTL_SECONDS * 1_000;

/** Compute the expiry Date for a new session */
export function sessionExpiresAt(): Date {
  return new Date(Date.now() + TRYON_SESSION_TTL_MS);
}
