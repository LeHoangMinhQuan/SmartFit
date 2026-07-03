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
  setAuth: (staffId: number, name: string, accessToken: string) => void;
  logout: () => void;
}

export const useStaffAuthStore = create<StaffAuthStore>()(
  persist(
    (set) => ({
      staffId: null,
      name: null,
      accessToken: null,
      setAuth: (staffId, name, accessToken) =>
        set({ staffId, name, accessToken }),
      logout: () => set({ staffId: null, name: null, accessToken: null }),
    }),
    {
      name: "staff-auth", // separate localStorage key from "auth" (customer store)
      // Same reasoning as useAuthStore: only persist identity, not the token.
      // Staff has no refresh flow, so a stale persisted token is just dead
      // weight — re-login is required after any page reload that loses it
      // from memory anyway once accessToken itself isn't persisted.
      partialize: (state) => ({ staffId: state.staffId, name: state.name, accessToken: state.accessToken }),
    },
  ),
);
