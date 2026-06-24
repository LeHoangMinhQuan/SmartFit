import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";
import { refreshAccessToken } from "../services/auth.client.service";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve) => {
        queue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }
    original._retry = true;
    isRefreshing = true;
    try {
      const accessToken = await refreshAccessToken();
      // setAuth requires a user — read the current one from the store
      const user = useAuthStore.getState().user!;
      useAuthStore.getState().setAuth(user, accessToken);
      queue.forEach((cb) => cb(accessToken));
      queue = [];
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch {
      useAuthStore.getState().clearAuth(); // was logout()
      localStorage.removeItem("refreshToken");
      queue = [];
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
