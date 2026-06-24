// store/useStaffAuthStore.ts
import { create } from "zustand";

interface StaffAuthStore {
  staffId: number | null;
  name: string | null;
  accessToken: string | null;
  setAuth: (staffId: number, name: string, token: string) => void;
  logout: () => void;
}

export const useStaffAuthStore = create<StaffAuthStore>((set) => ({
  staffId: null,
  name: null,
  accessToken: null,
  setAuth: (staffId, name, accessToken) => set({ staffId, name, accessToken }),
  logout: () => set({ staffId: null, name: null, accessToken: null }),
}));
