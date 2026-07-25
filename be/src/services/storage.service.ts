import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config/s3.js";
import { env } from "../config/env.js";

/**
 * storage.service.ts
 *
 * Centralises all direct S3 operations (delete, pre-sign, CDN URL building).
 * Uploads are handled by multer-s3 in middleware/upload.ts and middleware/tryonUpload.ts.
 *
 * The S3 bucket is fully private (Block Public Access ON, no bucket ACLs,
 * Object Ownership = bucket owner enforced). Public read access to product
 * and category images (`products/`, `categories/` prefixes) is provided by a
 * CloudFront distribution using Origin Access Control (OAC) — the bucket
 * policy only trusts that specific distribution, never the public internet
 * directly. See §10 of the API plan for the full CloudFront/IAM setup.
 *
 * Try-on assets (`tryon-sessions/` prefix) stay private and are never put
 * behind CloudFront — always serve via pre-signed URL.
 */

/**
 * Build the public CDN URL for an object under the `products/` or
 * `categories/` prefix. Use this instead of the raw multer-s3 `file.location`
 * (which points at the private S3 origin and would 403 in the browser).
 *
 * @param s3Key - e.g. "products/abc123.jpg" or "categories/def456.jpg"
 */
export function cdnUrlForKey(s3Key: string): string {
  return `https://${env.CDN_DOMAIN}/${s3Key}`;
}

/**
 * Generate a pre-signed GetObject URL for a private S3 object.
 * Used for tryon_session.result_url before returning to the client.
 *
 * @param s3Key  - The S3 object key, e.g. "tryon-sessions/abc123/result.jpg"
 * @param ttlSeconds - URL expiry in seconds. Defaults to 3600 (1 hour) to match
 *                     tryon_session.expires_at (DEFAULT NOW() + INTERVAL '1 hour').
 */
export async function getPresignedUrl(
  s3Key: string,
  ttlSeconds = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: s3Key,
  });
  return getSignedUrl(s3, command, { expiresIn: ttlSeconds });
}

/**
 * Delete a single S3 object by key.
 * Non-fatal — logs a warning on failure rather than throwing,
 * so a missing S3 object doesn't block DB cleanup.
 */
export async function deleteS3Object(s3Key: string): Promise<void> {
  try {
    await s3.send(
      new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: s3Key }),
    );
  } catch (err) {
    console.warn(`[storage] Failed to delete S3 object "${s3Key}":`, err);
  }
}

/**
 * Delete multiple S3 objects. Runs deletions in parallel.
 * Filters out null/undefined keys (e.g. when result_url is not yet set).
 */
export async function deleteS3Objects(
  keys: (string | null | undefined)[],
): Promise<void> {
  const valid = keys.filter(
    (k): k is string => typeof k === "string" && k.length > 0,
  );
  await Promise.all(valid.map(deleteS3Object));
}

/**
 * Extract the S3 key from a full S3 URL.
 * e.g. "https://bucket.s3.region.amazonaws.com/products/abc.jpg" → "products/abc.jpg"
 *
 * Use this when product_image.s3_url stores a full URL rather than just the key.
 */
export function s3KeyFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove leading slash from pathname
    return parsed.pathname.replace(/^\//, "");
  } catch {
    // If it's already a key (no protocol), return as-is
    return url;
  }
}
