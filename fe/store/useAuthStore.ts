import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  user_id: number;
  username: string;
  email: string;
  phone: string;
  address: string;
  avatar_url?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
}

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
