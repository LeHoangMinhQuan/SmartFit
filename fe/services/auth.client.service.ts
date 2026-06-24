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

  // Retrieve the raw refresh token — stored separately in localStorage
  // (not in Zustand, since it's a one-time-use credential).
  const refreshToken = localStorage.getItem("refreshToken");

  try {
    const response = await axios.post(
      `${API_BASE}/logout`,
      { refreshToken },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        // Don't throw on non-2xx so we can still clear state on network errors
        validateStatus: () => true,
      },
    );

    if (response.status === 204) {
      // Server confirmed the token row is deleted — clear everything client-side
      clearAuth();
      localStorage.removeItem("refreshToken");
    }
  } catch {
    // Network failure — clear client state anyway so the user isn't stuck
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
