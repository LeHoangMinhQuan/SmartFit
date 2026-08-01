import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  // Required for self-hosted deployments behind a reverse proxy (nginx
  // here) — Auth.js only auto-trusts the request Host on Vercel. Without
  // this, every /api/auth/* call throws UntrustedHost in production
  // (visible as an empty /api/auth/providers response and a 500 on
  // /api/auth/error), since it has no other way to confirm the incoming
  // Host header is legitimate rather than spoofed. Safe here because
  // nginx is the only thing that can reach this container directly (not
  // exposed publicly — see docker-compose network setup) and it always
  // sets Host to the real external domain (see SmartFit.conf's
  // proxy_set_header Host $host), so there's no actual host-spoofing
  // exposure despite the name sounding permissive.
  trustHost: true,
});
