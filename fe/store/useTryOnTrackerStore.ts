import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TrackedTryOnSession {
  session_id: number;
  product_id: number;
  variant_id: number;
  product_name?: string;
  variant_name?: string;
  thumbnail_url?: string | null;
  created_at: string;
  notified: boolean;
}

interface TryOnTrackerStore {
  sessions: TrackedTryOnSession[];
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  track: (
    session: Omit<TrackedTryOnSession, "created_at" | "notified">,
  ) => void;
  markNotified: (session_id: number) => void;
  untrack: (session_id: number) => void;
  pruneStale: () => void;
}

const STALE_AFTER_MS = 15 * 60 * 1000;
const MAX_TRACKED = 5;

export const useTryOnTrackerStore = create<TryOnTrackerStore>()(
  persist(
    (set) => ({
      sessions: [],
      hasHydrated: false,

      setHasHydrated: (v) => set({ hasHydrated: v }),

      track: (session) =>
        set((s) => {
          // Re-tracking an already-tracked session (e.g. re-visiting the
          // tryon page for the same in-flight session) shouldn't duplicate
          // it or reset its notified flag.
          if (s.sessions.some((x) => x.session_id === session.session_id)) {
            return s;
          }
          const next: TrackedTryOnSession[] = [
            ...s.sessions,
            {
              ...session,
              created_at: new Date().toISOString(),
              notified: false,
            },
          ];
          // Drop the oldest if over the cap.
          return {
            sessions:
              next.length > MAX_TRACKED
                ? next.slice(next.length - MAX_TRACKED)
                : next,
          };
        }),

      markNotified: (session_id) =>
        set((s) => ({
          sessions: s.sessions.map((x) =>
            x.session_id === session_id ? { ...x, notified: true } : x,
          ),
        })),

      untrack: (session_id) =>
        set((s) => ({
          sessions: s.sessions.filter((x) => x.session_id !== session_id),
        })),

      pruneStale: () => {
        const cutoff = Date.now() - STALE_AFTER_MS;
        set((s) => ({
          sessions: s.sessions.filter(
            (x) => new Date(x.created_at).getTime() > cutoff,
          ),
        }));
      },
    }),
    {
      name: "tryon-tracker",
      partialize: (state) => ({ sessions: state.sessions }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);