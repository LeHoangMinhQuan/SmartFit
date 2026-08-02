"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * components/auth/GoogleSessionBridge.tsx
 *
 * NOTE (2026-08-01): Google login has always gone through NextAuth only —
 * it never created a backend USER row or issued backend accessToken/
 * refreshToken cookies. Every backend-authenticated feature (orders,
 * wishlist, addresses, profile, chat — everything under UserMenu) 401'd
 * for a Google-signed-in visitor, because useAuthStore's `user` (what
 * those pages actually check) stayed null; only NextAuth's own session
 * existed. UserMenu.tsx previously worked around the symptom by faking a
 * display-only user object from session.user for the header avatar/name,
 * which is why it looked logged in while everything else silently wasn't
 * — that fallback object had no user_id and no cookies behind it.
 *
 * This is the actual fix: once NextAuth reports an authenticated session,
 * sync it into the backend (POST /api/auth/sync-google-user — validates the
 * session server-side, finds-or-creates the USER row, sets the same
 * cookies a normal login would) and populate useAuthStore with a real
 * user_id, exactly like email/password login already does. After this,
 * UserMenu's fallback merge is no longer needed — see its own updated
 * comment.
 *
 * Mirrors SessionVerifier.tsx's "run once after hydration" shape.
 */
export default function GoogleSessionBridge() {
  const { data: session, status } = useSession();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const storeUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  // Prevents re-firing on every render once a sync attempt is in flight
  // or has already resolved for this session — without this, a slow
  // network + React re-renders could fire several concurrent syncs.
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (status !== "authenticated" || !session) return;
    // Already have a real backend-authenticated user (either they logged
    // in with email/password, or a previous sync already ran and
    // populated this) — nothing to bridge.
    if (storeUser) return;
    if (syncedRef.current) return;
    syncedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/sync-google-user", {
          method: "POST",
        });
        if (!res.ok) {
          console.error("[GoogleSessionBridge] sync failed:", res.status);
          syncedRef.current = false; // allow a retry on the next render
          return;
        }
        const body = await res.json();
        if (!cancelled && body?.user) {
          setAuth(body.user);
        }
      } catch (err) {
        console.error("[GoogleSessionBridge] sync error:", err);
        syncedRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, status, session, storeUser, setAuth]);

  return null;
}
