import db from "../config/db.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRow {
  user_id: number;
  username: string;
  email: string;
  password_hash: string | null;
  phone: string | null; // CHAR(10) — nullable, see google_id below
  avatar_url: string | null;
  google_id: string | null;
  firebase_uid: string | null;
  created_at: Date;
}

export interface RefreshTokenRow {
  user_id: number;
  token_id: number;
  token_hash: string;
  expires_at: Date;
}

// ─── USER queries ───────────────────────────────────────────────────────────

export const findUserByEmail = (email: string): Promise<UserRow | undefined> =>
  db<UserRow>("USER").where({ email }).first();

export const findUserById = (user_id: number): Promise<UserRow | undefined> =>
  db<UserRow>("USER").where({ user_id }).first();

export const emailExists = async (email: string): Promise<boolean> => {
  const row = await db<UserRow>("USER")
    .where({ email })
    .select("user_id")
    .first();

  return !!row;
};

// user_id is GENERATED ALWAYS AS IDENTITY — never pass it on insert.
// .returning("*") gives back the row with the DB-assigned user_id.
export const insertUser = (user: {
  username: string;
  email: string;
  password_hash?: string | null; // null for Google-only accounts
  phone?: string | null; // null for Google-only accounts — see schema note
  google_id?: string | null;
  avatar_url?: string | null;
}): Promise<UserRow[]> => db<UserRow>("USER").insert(user).returning("*");

// Links an existing (password-based) account to a Google identity — used
// when syncGoogleUser (auth.service.ts) finds a USER row matching the
// Google account's email but without a google_id yet, so signing in with
// Google afterward reuses the same account instead of creating a
// duplicate.
export const linkGoogleId = (
  user_id: number,
  google_id: string,
  avatar_url: string | null,
): Promise<number> =>
  db<UserRow>("USER").where({ user_id }).update({ google_id, avatar_url });

export const findUserByGoogleId = (
  google_id: string,
): Promise<UserRow | undefined> =>
  db<UserRow>("USER").where({ google_id }).first();

// firebase_uid is populated best-effort at registration time (see
// auth.service.ts#register) and by the one-off backfill script for
// pre-existing users (scripts/backfill-firebase-users.ts).
export const updateUserFirebaseUid = (
  user_id: number,
  firebase_uid: string,
): Promise<number> =>
  db<UserRow>("USER").where({ user_id }).update({ firebase_uid });

// Used by resetPassword() once the Identity Toolkit REST call has already
// verified the oobCode and confirmed the email on Firebase's side — we
// still own password_hash ourselves since login goes through Postgres +
// our own JWTs, not Firebase sessions.
export const updateUserPasswordByEmail = (
  email: string,
  password_hash: string,
): Promise<number> =>
  db<UserRow>("USER").where({ email }).update({ password_hash });

// ─── refresh_token queries ────────────────────────────────────────────────────

// token_id is GENERATED ALWAYS AS IDENTITY — never pass it on insert.
// .returning("*") gives back the row with the DB-assigned token_id.
export const insertRefreshToken = (token: {
  user_id: number;
  token_hash: string;
  expires_at: Date;
}): Promise<RefreshTokenRow[]> =>
  db<RefreshTokenRow>("refresh_token").insert(token).returning("*");

export const findRefreshToken = (
  user_id: number,
  token_hash: string,
): Promise<RefreshTokenRow | undefined> =>
  db<RefreshTokenRow>("refresh_token")
    .where({ user_id, token_hash })
    .where("expires_at", ">", new Date())
    .first();

// Looked up by hash alone — used by POST /auth/refresh, which by design
// can't require a still-valid access token (the whole point of the call
// is to renew an access token that has already expired). The raw token is
// a 320-bit crypto-random value (see generateRefreshToken), so its SHA-256
// hash is already unguessable; no additional user_id scoping is needed for
// security.
export const findRefreshTokenByHash = (
  token_hash: string,
): Promise<RefreshTokenRow | undefined> =>
  db<RefreshTokenRow>("refresh_token")
    .where({ token_hash })
    .where("expires_at", ">", new Date())
    .first();

export const deleteRefreshToken = (
  user_id: number,
  token_hash: string,
): Promise<number> =>
  db("refresh_token").where({ user_id, token_hash }).delete();

export const deleteAllUserRefreshTokens = (user_id: number): Promise<number> =>
  db("refresh_token").where({ user_id }).delete();
