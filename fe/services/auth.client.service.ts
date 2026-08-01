import api from "@/lib/axios";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * services/auth.client.service.ts
 *
 * POST /api/app-auth/logout
 *
 * NOTE (2026-08-01): these hit /app-auth/*, not /auth/* — /api/auth/* is
 * now reserved entirely for NextAuth (Google login), which lives on the
 * frontend itself, not this backend. See the backend's app.ts mount
 * comment for the full story.
 *
 * Uses the shared `api` instance (lib/axios.ts) — same baseURL as every
 * other call, and `withCredentials: true` sends the httpOnly accessToken/
 * refreshToken cookies automatically. Nothing to read from localStorage
 * or attach as a header anymore.
 */
export const logoutService = async (): Promise<void> => {
  const { clearAuth } = useAuthStore.getState();

  try {
    await api.post(
      "/app-auth/logout",
      null,
      // We don't care if the server returns 401/500, we just want to attempt to tell it.
      { validateStatus: () => true },
    );
  } catch (error) {
    // Optional: Log network errors if needed, but no action required here
    console.error("Logout request failed:", error);
  } finally {
    // ALWAYS clear the local state, no matter what the server responded
    clearAuth();
  }
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  await api.post("/app-auth/forgot-password", { email });
};

export const confirmPasswordReset = async (
  oobCode: string,
  newPassword: string,
): Promise<void> => {
  await api.post("/app-auth/reset-password", { oobCode, newPassword });
};
