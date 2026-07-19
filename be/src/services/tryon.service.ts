// services/tryon.service.ts
import axios from "axios";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config/s3.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import * as tryonConfig from "../config/tryon.js";
import { tryonConstants } from "../config/tryon.js";
import { tryonQueue } from "./tryonQueue.js";
import { getPresignedUrl } from "./storage.service.js";
import * as TryonSession from "../models/tryon-session.model.js";
import type { ClothType } from "../schemas/tryon.schema.js";

async function presignS3Key(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

function parseInferenceResult(resultUrl: string): {
  buffer: Buffer;
  contentType: string;
} {
  const match = /^data:([^;]+);base64,(.+)$/.exec(resultUrl);
  const contentType = match?.[1];
  const base64Body = match?.[2];

  if (!contentType || !base64Body) {
    throw new ApiError(
      502,
      "Unexpected inference response format from try-on service",
    );
  }

  return { buffer: Buffer.from(base64Body, "base64"), contentType };
}

// ---------------------------------------------------------------------------
// 1. POST /api/tryon/session
// ---------------------------------------------------------------------------
export async function uploadUserPhoto(params: {
  file: Express.MulterS3.File;
  user_id: number;
  product_id: number;
  variant_id: number;
}) {
  const { file, user_id, product_id, variant_id } = params;

  const { session_id, expires_at } = await TryonSession.insertSession({
    user_id,
    product_id,
    variant_id,
    // Store the S3 KEY, not file.location — tryon-sessions/ is a private
    // prefix (no public bucket policy), so downstream consumers (including
    // Kaggle) must always go through a presigned URL, never the raw path.
    user_photo_url: file.key,
  });

  return { session_id, expires_at };
}

// ---------------------------------------------------------------------------
// 2. POST /api/tryon/preview  (enqueue only — never await the queue here)
// ---------------------------------------------------------------------------
export async function requestPreview(params: {
  session_id: number;
  user_id: number;
  cloth_type: ClothType;
}) {
  const { session_id, user_id, cloth_type } = params;

  const session = await TryonSession.findSessionById(session_id);
  if (!session) throw new ApiError(404, "Try-on session not found");
  if (session.user_id !== user_id)
    throw new ApiError(403, "Not your try-on session");
  if (new Date(session.expires_at) < new Date()) {
    throw new ApiError(410, "Try-on session has expired");
  }

  const garmentUrl = await TryonSession.findGarmentImageUrl(
    session.product_id,
    session.variant_id,
  );
  if (!garmentUrl)
    throw new ApiError(404, "No product image found for this variant");

  await TryonSession.markProcessing(session_id);

  // session.user_photo_url is an S3 KEY (private prefix) — presign it now,
  // right before the job is queued, so the URL Kaggle receives is fresh
  // even if this job sits behind others in the queue for a while.
  const personPresignedUrl = await presignS3Key(session.user_photo_url);

  // Fire-and-forget against the serialized queue. The request returns
  // immediately; the client polls GET /api/tryon/preview/:session_id.
  void tryonQueue.add(() =>
    runInference(session_id, personPresignedUrl, garmentUrl, cloth_type),
  );

  return { session_id, status: "processing" as const };
}

// ---------------------------------------------------------------------------
// Queue worker — the only place that talks to the Kaggle endpoint
// ---------------------------------------------------------------------------
async function runInference(
  session_id: number,
  personUrl: string,
  garmentUrl: string,
  cloth_type: ClothType,
): Promise<void> {
  const { base_url, shared_secret } = tryonConfig.getEndpoint();

  if (!base_url || !shared_secret) {
    await TryonSession.markFailed(session_id, "endpoint_not_registered");
    return;
  }

  try {
    await axios.get(`${base_url}/health`, {
      timeout: tryonConstants.HEALTH_CHECK_TIMEOUT_MS,
    });
    tryonConfig.recordHealthCheck(true);
  } catch {
    tryonConfig.recordHealthCheck(false);
    await TryonSession.markFailed(session_id, "endpoint_offline");
    return;
  }

  try {
    const { data } = await axios.post<{ result_url: string }>(
      `${base_url}/infer`,
      { person_image: personUrl, cloth_image: garmentUrl, cloth_type },
      {
        headers: { Authorization: `Bearer ${shared_secret}` },
        timeout: tryonConstants.INFERENCE_TIMEOUT_MS,
      },
    );

    // Kaggle has no public storage of its own, so /infer returns the result
    // inline as a base64 data: URL rather than a second HTTP link to fetch.
    // Support both shapes in case a future adapter (e.g. one that does
    // upload to some storage itself) returns a real URL instead.
    let resultBuffer: Buffer;
    let contentType = "image/jpeg";

    if (data.result_url.startsWith("data:")) {
      const parsed = parseInferenceResult(data.result_url);
      resultBuffer = parsed.buffer;
      contentType = parsed.contentType;
    } else {
      const { data: arrayBuffer } = await axios.get<ArrayBuffer>(
        data.result_url,
        {
          responseType: "arraybuffer",
        },
      );
      resultBuffer = Buffer.from(arrayBuffer);
    }

    const key = `${tryonConstants.S3_PREFIX}/${session_id}/result.jpg`;
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: resultBuffer,
        ContentType: contentType,
      }),
    );

    await TryonSession.markReady(session_id, key);
  } catch (err: any) {
    const reason = err?.code === "ECONNABORTED" ? "timeout" : "inference_error";
    await TryonSession.markFailed(session_id, reason);
  }
}

// ---------------------------------------------------------------------------
// 3. GET /api/tryon/preview/:session_id
// ---------------------------------------------------------------------------
export async function getPreviewStatus(session_id: number, user_id: number) {
  const session = await TryonSession.findSessionById(session_id);
  if (!session) throw new ApiError(404, "Try-on session not found");
  if (session.user_id !== user_id)
    throw new ApiError(403, "Not your try-on session");

  if (session.status === "ready") {
    const result_url = await getPresignedUrl(session.result_url!);
    return {
      status: "ready" as const,
      result_url,
      expires_at: session.expires_at,
    };
  }
  if (session.status === "failed") {
    return { status: "failed" as const, reason: session.failure_reason };
  }
  return { status: "processing" as const };
}

// ---------------------------------------------------------------------------
// DELETE /api/tryon/session/:session_id
// ---------------------------------------------------------------------------
export async function deleteSession(session_id: number, user_id: number) {
  const session = await TryonSession.findSessionById(session_id);
  if (!session) throw new ApiError(404, "Try-on session not found");
  if (session.user_id !== user_id)
    throw new ApiError(403, "Not your try-on session");

  // The photo key was generated at upload time (its own UUID, assigned
  // before session_id existed) and the result key (if any) uses session_id
  // — they don't share a common prefix, so delete both explicit keys
  // rather than scanning one.
  const keys = [session.user_photo_url, session.result_url].filter(
    (k): k is string => Boolean(k),
  );
  if (keys.length > 0) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: env.S3_BUCKET,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );
  }

  await TryonSession.deleteSessionById(session_id);
}
