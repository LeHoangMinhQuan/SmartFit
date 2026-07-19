// store/useAuthModalStore.ts
import { create } from "zustand";

interface AuthModalStore {
  loginOpen: boolean;
  registerOpen: boolean;

  openLogin: () => void;
  openRegister: () => void;
  closeLogin: () => void;
  closeRegister: () => void;
}

export const useAuthModalStore = create<AuthModalStore>((set) => ({
  loginOpen: false,
  registerOpen: false,

  openLogin: () =>
    set({
      loginOpen: true,
      registerOpen: false,
    }),

  openRegister: () =>
    set({
      loginOpen: false,
      registerOpen: true,
    }),

  closeLogin: () =>
    set({
      loginOpen: false,
    }),

  closeRegister: () =>
    set({
      registerOpen: false,
    }),
}));
