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
  callbacks: {
    // NextAuth's default session.user has no stable id at all — just
    // name/email/image. app/api/auth/sync-google-user/route.ts needs Google's
    // own account id (not just email) to reliably find-or-create the
    // matching backend USER row, so thread it through: jwt callback
    // copies it from `account` (only present on the initial sign-in,
    // per NextAuth's contract) into the token, session callback exposes
    // it on session.user.id.
    async jwt({ token, account }) {
      if (account?.provider === "google" && account.providerAccountId) {
        token.googleId = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.googleId && session.user) {
        (session.user as typeof session.user & { id?: string }).id =
          token.googleId as string;
      }
      return session;
    },
  },
});
