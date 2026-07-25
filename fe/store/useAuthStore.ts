import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthState } from "../interfaces";

/**
 * store/useAuthStore.ts
 *
 * Tracks only the (non-sensitive) `user` object, persisted to
 * localStorage purely so the UI doesn't flash "logged out" for a beat
 * on page load/reload. The actual credentials — accessToken and
 * refreshToken — never touch this store, localStorage, or any other
 * JS-readable state; they live in httpOnly cookies set by the backend
 * (see BE utils/cookies.ts) that the browser attaches automatically via
 * axios's `withCredentials: true`.
 *
 * `user` doubles as the "am I logged in" signal used across the app
 * (e.g. gating fetches on the cart/checkout pages) — it's the one piece
 * of auth state that's actually durable across a reload, since the
 * access token is short-lived and invisible to JS.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      setAuth: (user) => set({ user }),

      clearAuth: () => set({ user: null }),
    }),
    {
      name: "auth", // localStorage key — user object only, never tokens
    },
  ),
);
