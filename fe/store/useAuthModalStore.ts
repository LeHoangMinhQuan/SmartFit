// store/useAuthModalStore.ts
import { create } from "zustand";

interface AuthModalStore {
  loginOpen: boolean;
  registerOpen: boolean;
  forgotPasswordOpen: boolean;

  openLogin: () => void;
  openRegister: () => void;
  openForgotPassword: () => void;
  closeLogin: () => void;
  closeRegister: () => void;
  closeForgotPassword: () => void;
}

export const useAuthModalStore = create<AuthModalStore>((set) => ({
  loginOpen: false,
  registerOpen: false,
  forgotPasswordOpen: false,

  openLogin: () =>
    set({
      loginOpen: true,
      registerOpen: false,
      forgotPasswordOpen: false,
    }),

  openRegister: () =>
    set({
      loginOpen: false,
      registerOpen: true,
      forgotPasswordOpen: false,
    }),

  openForgotPassword: () =>
    set({
      loginOpen: false,
      registerOpen: false,
      forgotPasswordOpen: true,
    }),

  closeLogin: () =>
    set({
      loginOpen: false,
    }),

  closeRegister: () =>
    set({
      registerOpen: false,
    }),

  closeForgotPassword: () =>
    set({
      forgotPasswordOpen: false,
    }),
}));
