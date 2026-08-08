import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StaffRole {
  role_id: number;
  name: string;
}

export interface StaffAuthUser {
  staff_id: number;
  name: string;
}

interface StaffAuthStore {
  staffId: number | null;
  name: string | null;
  roles: StaffRole[];
  accessToken: string | null;
  hasHydrated: boolean;
  setAuth: (
    staffId: number,
    name: string,
    accessToken: string,
    roles: StaffRole[],
  ) => void;
  setAccessToken: (accessToken: string) => void;
  setRoles: (roles: StaffRole[]) => void;
  isAdmin: () => boolean;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useStaffAuthStore = create<StaffAuthStore>()(
  persist(
    (set, get) => ({
      staffId: null,
      name: null,
      roles: [],
      accessToken: null,
      hasHydrated: false,
      setAuth: (staffId, name, accessToken, roles) =>
        set({ staffId, name, accessToken, roles }),
      setAccessToken: (accessToken) => set({ accessToken }),
      // Called on every /admin/auth/refresh response too (not just login) —
      // role changes should take effect on the next refresh without
      // requiring the staff account to log out/in again, matching the
      // backend's own "authorize() checks role_assigment fresh per-request"
      // design.
      setRoles: (roles) => set({ roles }),
      isAdmin: () => get().roles.some((r) => r.name === "admin"),
      logout: () =>
        set({ staffId: null, name: null, accessToken: null, roles: [] }),
      setHasHydrated: (state) => set({ hasHydrated: state }),
    }),
    {
      name: "staff-auth",
      // Same reasoning as useAuthStore: only persist identity, not the
      // token. roles is also NOT persisted — it's re-fetched fresh on
      // every login and every silent refresh (staffRefresh returns roles
      // too), so a stale persisted copy would only risk showing/hiding nav
      // items and buttons based on out-of-date permissions between logins.
      // The layout's mount-time refresh call re-populates it before the
      // app ever renders anything gated on roles.
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
