import { useAuthStore } from "../store/useAuthStore";

export function useAuth() {
  return useAuthStore(); // thin re-export — add helpers here as needed
}
