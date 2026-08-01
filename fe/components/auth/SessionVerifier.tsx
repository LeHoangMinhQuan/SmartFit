"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { userService } from "@/services/user.service";

/**
 * components/auth/SessionVerifier.tsx
 *
 * Bug fixed: useAuthStore persists `user` to localStorage indefinitely
 * (see store/useAuthStore.ts), with no expiry and no server check. The
 * httpOnly accessToken cookie is separate and can go away independently —
 * cleared manually, blocked by browser settings, or the refresh token
 * itself expiring — while localStorage's `user` object just sits there
 * looking valid. The result: the UI shows "logged in" (Header, cart,
 * chat, everywhere gated on `useAuthStore.user`) but every real request
 * 401s, because there's no token to send. Previously this only got
 * cleaned up reactively, whenever some unrelated API call happened to
 * 401 and lib/axios.ts's interceptor gave up on refreshing and called
 * clearAuth() — meaning a user could sit on a page that makes no API
 * calls and see a fully "logged in" UI that's actually dead.
 *
 * Fix: once per app load, after the persisted store rehydrates, actively
 * verify the session with a real request (GET /users/me) rather than
 * waiting for one to happen incidentally. lib/axios.ts's existing 401
 * interceptor still does the refresh-then-clearAuth work; this only
 * makes sure that check actually runs promptly instead of maybe never.
 */
export default function SessionVerifier() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    if (!hasHydrated || !user) return;

    let cancelled = false;
    userService.getProfile().catch(() => {
      // lib/axios.ts's interceptor already tried a refresh and failed
      // before this rejection reaches here — this really is a dead
      // session, not a transient network blip.
      if (!cancelled) clearAuth();
    });

    return () => {
      cancelled = true;
    };
    // Only re-verify when hydration completes, not on every `user` change
    // (e.g. a normal login/logout already manages state directly).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  return null;
}
