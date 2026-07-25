import db from "../config/db.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRow {
  user_id: number;
  username: string;
  email: string;
  password_hash: string;
  phone: string; // CHAR(10) NOT NULL
  address: string; // VARCHAR(70) NOT NULL
  avatar_url: string | null;
  google_id: string | null;
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
  password_hash: string;
  phone: string; // CHAR(10) NOT NULL
  address: string; // VARCHAR(70) NOT NULL
}): Promise<UserRow[]> => db<UserRow>("USER").insert(user).returning("*");

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
