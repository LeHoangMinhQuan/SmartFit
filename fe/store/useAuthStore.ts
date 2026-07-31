import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthState } from "../interfaces";

/**
 * store/useAuthStore.ts
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
