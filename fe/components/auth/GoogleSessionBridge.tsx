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
  // FIXED (2026-08-09): only destructure `status` (a plain string), not
  // `data: session`. next-auth's SessionProvider context frequently hands
  // back a new `session` object reference on renders where the data is
  // otherwise unchanged. With `session` in this effect's dependency
  // array, ANY unrelated re-render of this always-mounted component
  // (toast, cart update, route change — anything) could recreate the
  // session reference, which reran the effect's cleanup mid-flight
  // (`cancelled = true`) while the sync fetch was still in the air. The
  // fetch would complete, see `cancelled === true`, and silently drop
  // `setAuth(body.user)` — but `syncedRef.current` was already `true`
  // and nothing resets it on that path, so the bridge could never retry
  // without a full page reload (a fresh mount ⇒ fresh ref). That's
  // exactly the "logs in with Google, UI never updates until I refresh
  // (or it randomly catches up a few seconds later if no re-render
  // happened to land in that window)" bug. `sync-google-user` doesn't
  // even read anything from the client `session` object — it re-derives
  // everything server-side via `auth()` — so nothing here actually
  // needed it in the first place.
  const { status } = useSession();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const storeUser = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  // Prevents re-firing on every render once a sync attempt is in flight
  // or has already resolved for this session — without this, a slow
  // network + React re-renders could fire several concurrent syncs.
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (status !== "authenticated") return;
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
    // `status` is intentionally the only session-derived dependency —
    // see the comment above.
  }, [hasHydrated, status, storeUser, setAuth]);

  return null;
}
