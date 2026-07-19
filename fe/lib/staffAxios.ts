import axios from "axios";
import { useStaffAuthStore } from "../store/useStaffAuthStore";

const staffApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  withCredentials: true, // carries the httpOnly staff_refresh_token cookie
});

staffApi.interceptors.request.use((config) => {
  const token = useStaffAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue: Array<(token: string | null) => void> = [];

function resolveQueue(token: string | null) {
  queue.forEach((cb) => cb(token));
  queue = [];
}

/**
 * Obtain a fresh access token via the httpOnly staff_refresh_token cookie.
 * Shared between the 401 interceptor below and app/staff/layout.tsx's
 * mount-time session check — both need the same "one refresh call, queue
 * everyone else" behavior, so it lives here instead of being duplicated.
 */
export async function refreshStaffAccessToken(): Promise<string> {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      queue.push((token) =>
        token ? resolve(token) : reject(new Error("Refresh failed")),
      );
    });
  }

  isRefreshing = true;
  try {
    // Plain axios, not staffApi — avoids recursively hitting this interceptor.
    const { data } = await axios.post(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/auth/refresh`,
      {},
      { withCredentials: true },
    );
    const accessToken = data.data.accessToken;
    useStaffAuthStore.getState().setAccessToken(accessToken);
    resolveQueue(accessToken);
    return accessToken;
  } catch (err) {
    resolveQueue(null);
    throw err;
  } finally {
    isRefreshing = false;
  }
}

staffApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isRefreshCall = original?.url?.includes("/admin/auth/refresh");

    if (error.response?.status !== 401 || original?._retry || isRefreshCall) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      const accessToken = await refreshStaffAccessToken();
      original.headers.Authorization = `Bearer ${accessToken}`;
      return staffApi(original);
    } catch (refreshError) {
      useStaffAuthStore.getState().logout();
      if (typeof window !== "undefined") window.location.href = "/staff/login";
      return Promise.reject(refreshError);
    }
  },
);

export default staffApi;
