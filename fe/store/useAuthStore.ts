import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthState } from "../interfaces";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,

      setAuth: (user, accessToken) => set({ user, accessToken }),

      clearAuth: () => set({ user: null, accessToken: null }),
    }),
    {
      name: "auth", // localStorage key
      // Only persist user — accessToken is short-lived (15 min).
      // The refresh flow will re-issue it; no point storing it across sessions.
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
