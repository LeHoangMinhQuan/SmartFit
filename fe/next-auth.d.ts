import "next-auth";
import "next-auth/jwt";
import type { DefaultSession } from "next-auth";

// Augments NextAuth's built-in types with the fields auth.ts's callbacks
// add — see auth.ts's jwt/session callbacks and
// app/api/auth/sync-google-user/route.ts, which is what actually reads
// session.user.id.
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    googleId?: string;
  }
}
