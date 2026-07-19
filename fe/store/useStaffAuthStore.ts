import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StaffAuthUser {
  staff_id: number;
  name: string;
}

interface StaffAuthStore {
  staffId: number | null;
  name: string | null;
  accessToken: string | null;
  hasHydrated: boolean;
  setAuth: (staffId: number, name: string, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useStaffAuthStore = create<StaffAuthStore>()(
  persist(
    (set) => ({
      staffId: null,
      name: null,
      accessToken: null,
      hasHydrated: false,
      setAuth: (staffId, name, accessToken) =>
        set({ staffId, name, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => set({ staffId: null, name: null, accessToken: null }),
      setHasHydrated: (state) => set({ hasHydrated: state }),
    }),
    {
      name: "staff-auth",
      // Same reasoning as useAuthStore: only persist identity, not the token.
      partialize: (state) => ({ staffId: state.staffId, name: state.name }),
      // Rehydration from localStorage is async — components must wait for
      // this flag before treating a null staffId as "not logged in", or
      // they'll redirect on the first render, before the persisted value
      // has even loaded. See app/staff/layout.tsx.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
