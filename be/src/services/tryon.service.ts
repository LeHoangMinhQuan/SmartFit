import { ApiError} from "../utils/ApiError.js";
import * as TryonModel from "../models/tryon_session.model.js";
import {tryonClient} from "../config/tryon.js";
import * as ProductModel from "../models/product/product.model.js";

export async function createSession(
  user_id: number,
  product_id: number,
  variant_id: number,
  photoPath: string,
) {
  const variant = await ProductModel.findVariant(product_id, variant_id);
  if (!variant) throw new ApiError(404, "Product variant not found");

  // photoPath is the uploaded file path/S3 URL
  const { session_id, expires_at } = await TryonModel.createTryonSession({
    user_id,
    product_id,
    variant_id,
    user_photo_url: photoPath,
  });

  return { session_id, expires_at };
}

export async function submitPreview(
  user_id: number,
  session_id: number,
  product_id: number,
  variant_id: number,
) {
  const session = await TryonModel.findTryonSessionByUser(session_id, user_id);
  if (!session) throw new ApiError(403, "Session not found or access denied");
  if (new Date(session.expires_at) < new Date())
    throw new ApiError(410, "Session has expired");

  // Update session with requested product/variant
  await TryonModel.updateTryonSession(session_id, { status: "processing" });

  // Call AI provider (abstracted via config/tryon.ts)
  setImmediate(async () => {
    try {
      const jobId = await tryonClient.submitJob(
        session.user_photo_url,
        product_id,
        variant_id,
      );
      // Poll or store jobId — for now, update with result URL when ready
      const result_url = await tryonClient.getResult(jobId);
      await TryonModel.updateTryonSession(session_id, {
        status: "ready",
        result_url,
      });
    } catch (err) {
      console.error(`[TryOn] Job failed for session ${session_id}:`, err);
      await TryonModel.updateTryonSession(session_id, { status: "failed" });
    }
  });

  return { session_id, status: "processing" };
}

export async function pollSession(user_id: number, session_id: number) {
  const session = await TryonModel.findTryonSessionByUser(session_id, user_id);
  if (!session) throw new ApiError(403, "Session not found or access denied");
  return {
    session_id: session.session_id,
    status: session.status,
    result_url: session.result_url ?? null,
    expires_at: session.expires_at,
  };
}

export async function deleteSession(user_id: number, session_id: number) {
  const session = await TryonModel.findTryonSessionByUser(session_id, user_id);
  if (!session) throw new ApiError(403, "Session not found or access denied");

  // Delete S3 objects if applicable
  try {
    await tryonClient.deleteAssets(session.user_photo_url, session.result_url);
  } catch {
    // Non-fatal — proceed with DB deletion
  }

  await TryonModel.deleteTryonSession(session_id);
}
