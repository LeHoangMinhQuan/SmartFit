import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * POST /api/auth/sync-google-user
 *
 * NOTE (2026-08-01): moved here from /api/sync-google-user — that path
 * fell through your nginx config's `location /api/` block (backend,
 * port 3000) rather than `location /api/auth/` (frontend, port 3001),
 * since it didn't start with /api/auth/. Same class of bug as the
 * original NextAuth-routes-hitting-the-backend issue, just on a
 * different specific path this time. Confirmed via Next.js's own docs
 * that a static route here takes precedence over the sibling
 * [...nextauth] catch-all for this exact path, so this doesn't
 * interfere with any NextAuth-internal route.
 *
 * NOTE (2026-08-01): Google login has always gone through NextAuth
 * entirely — it was never bridged into the backend's own USER table or
 * JWT/cookie auth. A Google-authenticated visitor had a valid NextAuth
 * session but no backend accessToken/refreshToken cookies and no USER
 * row, so every backend-authenticated feature (orders, wishlist,
 * addresses, profile, chat — everything under UserMenu) 401'd for them,
 * and they never showed up in admin's new-user counts.
 *
 * This route is the bridge: called once a NextAuth session exists (see
 * hooks/useGoogleSessionBridge.ts), it validates that session
 * server-side via auth(), forwards the account's identity to the
 * backend's POST /api/app-auth/google-sync (protected by
 * X-Internal-Secret — see that controller's doc comment for why this
 * can't just be called directly from the browser), and relays the
 * resulting Set-Cookie headers back to the browser so the normal
 * accessToken/refreshToken cookies end up set exactly as they would
 * after a regular email/password login.
 */
export async function POST() {
  const session = await auth();
  const googleId = session?.user?.id;

  if (!session?.user || !googleId || !session.user.email) {
    return NextResponse.json(
      { status: "error", message: "No Google session to sync" },
      { status: 401 },
    );
  }

  // Server-side call, not a browser request — reuses the same public
  // base URL the rest of the app calls through (nginx/Cloudflare) rather
  // than assuming a specific docker-network hostname, since that varies
  // by deployment. Switch to an internal docker-network URL here if
  // you'd rather avoid the round trip back out through the proxy.
  const backendBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const internalSecret = process.env.GOOGLE_SYNC_SECRET;

  if (!backendBaseUrl || !internalSecret) {
    console.error(
      "[sync-google-user] NEXT_PUBLIC_BASE_URL or GOOGLE_SYNC_SECRET not configured",
    );
    return NextResponse.json(
      { status: "error", message: "Sync not configured" },
      { status: 500 },
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendBaseUrl}/app-auth/google-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": internalSecret,
      },
      body: JSON.stringify({
        email: session.user.email,
        google_id: googleId,
        username: session.user.name || session.user.email.split("@")[0],
        avatar_url: session.user.image ?? null,
      }),
    });
  } catch (err) {
    console.error("[sync-google-user] backend request failed:", err);
    return NextResponse.json(
      { status: "error", message: "Could not reach backend" },
      { status: 502 },
    );
  }

  const body = await backendRes.json().catch(() => null);
  if (!backendRes.ok) {
    console.error("[sync-google-user] backend rejected sync:", body);
    return NextResponse.json(
      { status: "error", message: "Sync failed" },
      { status: backendRes.status },
    );
  }

  // fetch() doesn't expose multiple Set-Cookie headers via a single
  // .get() — getSetCookie() (available on Next.js's fetch Headers
  // polyfill) returns each one individually, needed here since the
  // backend sets two cookies (accessToken + refreshToken) in one
  // response.
  // Defense-in-depth alongside middleware.ts's blanket /api/auth/* rule —
  // this response is per-user (sets accessToken/refreshToken cookies) and
  // must never be cached by Cloudflare or any intermediate proxy.
  const response = NextResponse.json({ user: body.user }, { status: 200 });
  response.headers.set("Cache-Control", "no-store, no-cache, private");
  const setCookieHeaders = backendRes.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookieHeaders) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}
