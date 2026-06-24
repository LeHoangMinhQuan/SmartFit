import api from "../lib/axios";
import type { TryOnSession } from "../interfaces";

interface UploadPhotoResponse {
  session_id: number;
  expires_at: string;
}

interface RequestPreviewBody {
  session_id: number;
  product_id: number;
  variant_id: number;
}

export const tryonService = {
  // Uploads the user's photo as multipart/form-data.
  // Field name must be "photo". Max 10 MB, JPEG/PNG/WEBP only.
  // Returns session_id (auto-generated INT from DB) + expires_at.
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.append("photo", file);
    return api
      .post<UploadPhotoResponse>("/api/tryon/session", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  // Triggers the AI composite. Status transitions to 'processing' or 'ready'
  // depending on whether the AI call is sync or async.
  requestPreview: (body: RequestPreviewBody) =>
    api.post("/api/tryon/preview", body).then((r) => r.data),

  // Poll this every 3 s until status === 'ready' or 'failed'.
  // On 429, show rate-limit message (5 requests per 10 minutes per user).
  getPreviewStatus: (session_id: number) =>
    api
      .get<TryOnSession>(`/api/tryon/preview/${session_id}`)
      .then((r) => r.data),

  deleteSession: (session_id: number) =>
    api.delete(`/api/tryon/session/${session_id}`).then((r) => r.data),
};
