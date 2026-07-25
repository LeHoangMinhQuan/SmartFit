import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

/**
 * lib/axios.ts
 *
 * `withCredentials: true` is what makes the browser attach the httpOnly
 * accessToken/refreshToken cookies automatically on every request — there
 * is no Authorization header to set manually anymore, since the token
 * lives outside of JS-readable state entirely (see BE utils/cookies.ts).
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let queue: Array<() => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve) => {
        queue.push(() => resolve(api(original)));
      });
    }
    original._retry = true;
    isRefreshing = true;
    try {
      // The refreshToken cookie (path-scoped to /api/auth) is sent
      // automatically. On success the server rotates the accessToken
      // cookie in its response — nothing to read or store here.
      await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      );
      queue.forEach((cb) => cb());
      queue = [];
      return api(original);
    } catch (refreshError) {
      useAuthStore.getState().clearAuth();
      queue = [];
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
