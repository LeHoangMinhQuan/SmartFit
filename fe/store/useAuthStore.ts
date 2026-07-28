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
 *
 * Rehydration from localStorage is async — `user` starts out `null` on
 * every fresh page load even for a logged-in person, until the persisted
 * value loads a beat later. Consumers MUST wait for `hasHydrated` before
 * treating a null `user` as "not logged in", or they'll redirect / show an
 * empty state on the first render, before the real value has loaded.
 * (Same pattern as useStaffAuthStore — see app/staff/layout.tsx.)
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hasHydrated: false,

      setAuth: (user) => set({ user }),

      clearAuth: () => set({ user: null }),

      setHasHydrated: (state) => set({ hasHydrated: state }),
    }),
    {
      name: "auth", // localStorage key — user object only, never tokens
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
