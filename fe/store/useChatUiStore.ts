import { create } from "zustand";

/**
 * store/useChatUiStore.ts
 *
 * Deliberately tiny — useChat (@ai-sdk/react) owns the message list and
 * streaming status itself; this store only holds the two things outside
 * that hook's scope: whether the panel is open, and which session_id to
 * thread into the next sendMessage request.
 *
 * NOT persisted to localStorage (unlike useAuthStore) — a fresh page load
 * starts a new conversation, matching ecommerce-fe-plan.md §11.
 */
interface ChatUiStore {
  isOpen: boolean;
  sessionId: number | null;
  toggleOpen: () => void;
  setSessionId: (id: number) => void;
  reset: () => void;
}

export const useChatUiStore = create<ChatUiStore>((set) => ({
  isOpen: false,
  sessionId: null,

  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setSessionId: (id) => set({ sessionId: id }),

  // Called on logout — useChat's own message state is component-local and
  // clears naturally on unmount/remount, so there's nothing to reset there.
  reset: () => set({ isOpen: false, sessionId: null }),
}));
