import axios from "axios";
import { useAuthStore } from "@/store/useAuthStore";

const API_BASE = process.env.NEXT_PUBLIC_BASE_URL;

/**
 * POST /api/auth/logout
 *
 * Sends the stored refresh token (from localStorage) alongside the access
 * token in the Authorization header. On 204 the server has deleted the
 * refresh_token row; we then wipe all client-side auth state.
 */
export const logoutService = async (): Promise<void> => {
  const { accessToken, clearAuth } = useAuthStore.getState();
  const refreshToken = localStorage.getItem("refreshToken");

  try {
    await axios.post(
      `${API_BASE}/logout`,
      { refreshToken },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        // We don't care if the server returns 401/500, we just want to attempt to tell it.
        validateStatus: () => true,
      },
    );
  } catch (error) {
    // Optional: Log network errors if needed, but no action required here
    console.error("Logout request failed:", error);
  } finally {
    // ALWAYS clear the local state, no matter what the server responded
    clearAuth();
    localStorage.removeItem("refreshToken");
  }
};

// --- new export ---
/**
 * POST /api/auth/refresh
 * Sends the refresh token from localStorage, returns the new access token.
 * Called by the Axios interceptor in lib/axios.ts — must NOT use the api
 * instance (would cause an infinite loop on 401).
 */
export const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = localStorage.getItem("refreshToken");
  const response = await axios.post<{ accessToken: string }>(
    `${API_BASE}/refresh`,
    { refreshToken },
  );
  return response.data.accessToken;
};
