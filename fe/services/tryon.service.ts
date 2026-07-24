import api from "../lib/axios";
import type { ClothType, TryOnPollResult } from "../interfaces";

interface UploadPhotoResponse {
  session_id: number;
  expires_at: string;
}

interface RequestPreviewBody {
  session_id: number;
  cloth_type?: ClothType;
}

export const tryonService = {
  // Uploads the user's photo as multipart/form-data.
  // Field name must be "photo". Max 10 MB, JPEG/PNG/WEBP only.
  // product_id/variant_id MUST be sent here (not at preview time) —
  // tryonSessionUploadSchema requires them, and tryon_session.product_id /
  // .variant_id are NOT NULL FKs to product_variant. The session is
  // pinned to a variant from the moment the photo is uploaded.
  // Returns session_id (auto-generated INT from DB) + expires_at.
  uploadPhoto: (file: File, product_id: number, variant_id: number) => {
    const form = new FormData();
    form.append("photo", file);
    form.append("product_id", String(product_id));
    form.append("variant_id", String(variant_id));
    return api
      .post<UploadPhotoResponse>("/tryon/session", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  // Triggers the AI composite. product_id/variant_id are intentionally NOT
  // sent here — they're already pinned to the session from uploadPhoto.
  // Only session_id + optional cloth_type (defaults to 'upper' server-side
  // if omitted). Status transitions to 'processing' or 'ready' depending
  // on whether the AI call is sync or async.
  requestPreview: (body: RequestPreviewBody) =>
    api.post("/tryon/preview", body).then((r) => r.data),

  // Poll this every 3 s until status === 'ready' or 'failed'.
  // NOTE: a 429 from THIS endpoint comes from the global 200/15min
  // limiter, not the 5/10min tryonLimiter — that one only guards
  // POST /tryon/session (the upload call), not polling.
  getPreviewStatus: (session_id: number) =>
    api
      .get<TryOnPollResult>(`/tryon/preview/${session_id}`)
      .then((r) => r.data),

  deleteSession: (session_id: number) =>
    api.delete(`/tryon/session/${session_id}`).then((r) => r.data),
};
