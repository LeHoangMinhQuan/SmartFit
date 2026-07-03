import axios from "axios";
import { useStaffAuthStore } from "../store/useStaffAuthStore";

// Completely separate instance from lib/axios.ts. Staff JWTs are signed with
// STAFF_JWT_SECRET (different from the customer JWT secret) and must never
// be attached to customer API calls or vice versa.
const staffApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
  withCredentials: true,
});

staffApi.interceptors.request.use((config) => {
  const token = useStaffAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// No refresh flow for staff — the API plan exposes only
// POST /api/admin/auth/login and POST /api/admin/auth/logout, no refresh
// endpoint. On 401, the session is simply over: clear state and bounce to
// /staff/login. (Compare to lib/axios.ts, which retries once via
// refreshAccessToken() before giving up — that machinery doesn't exist here.)
staffApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useStaffAuthStore.getState().logout();
      if (typeof window !== "undefined") {
        window.location.href = "/staff/login";
      }
    }
    return Promise.reject(error);
  },
);

export default staffApi;
