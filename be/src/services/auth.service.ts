import bcrypt from "bcryptjs";
import { ApiError } from "../utils/ApiError.js";
import {
  signUserAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from "../utils/jwt.js";
import {
  findUserByEmail,
  findUserById,
  insertUser,
  insertRefreshToken,
  findRefreshTokenByHash,
  deleteRefreshToken,
  emailExists,
} from "../models/user.model.js";
import type { RegisterBody, LoginBody } from "../schemas/auth.schema.js";

const BCRYPT_ROUNDS = 12;

// ─── Shared token issuer ──────────────────────────────────────────────────────

/**
 * Signs an access token + generates a refresh token, persists the hash,
 * and returns both to the caller.
 */
const issueTokens = async (
  user_id: number,
  email: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = signUserAccessToken({ user_id, email });

  const rawRefresh = generateRefreshToken();
  const token_hash = hashRefreshToken(rawRefresh);
  const expires_at = refreshTokenExpiresAt();

  // token_id is GENERATED ALWAYS AS IDENTITY — the DB assigns it on insert.
  // No need to compute a "next" token_id ourselves anymore.
  await insertRefreshToken({
    user_id,
    token_hash,
    expires_at,
  });

  return {
    accessToken,
    refreshToken: rawRefresh,
  };
};

// ─── Register ─────────────────────────────────────────────────────────────────

export interface RegisterResult {
  user: {
    user_id: number;
    username: string;
    email: string;
    phone: string;
  };
  accessToken: string;
  refreshToken: string;
}

export const register = async (body: RegisterBody): Promise<RegisterResult> => {
  // 1. Duplicate email check
  if (await emailExists(body.email)) {
    throw new ApiError(409, "An account with this email already exists");
  }

  // 2. Hash password
  const password_hash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

  // 3. Insert user — user_id is GENERATED ALWAYS AS IDENTITY
  const [user] = await insertUser({
    username: body.username,
    email: body.email,
    password_hash,
    phone: body.phone,
  });

  if (!user) {
    throw new ApiError(500, "Failed to create user");
  }

  // 4. Issue tokens
  const { accessToken, refreshToken } = await issueTokens(
    user.user_id,
    user.email,
  );

  return {
    user: {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      phone: user.phone,
    },
    accessToken,
    refreshToken,
  };
};

// ─── Login ────────────────────────────────────────────────────────────────────

export interface LoginResult {
  user: {
    user_id: number;
    username: string;
    email: string;
    phone: string;
  };
  accessToken: string;
  refreshToken: string;
}

export const login = async (body: LoginBody): Promise<LoginResult> => {
  // 1. Find user
  const user = await findUserByEmail(body.email);

  // Same error message to prevent user enumeration
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  // 2. Verify password
  const valid = await bcrypt.compare(body.password, user.password_hash);

  if (!valid) {
    throw new ApiError(401, "Invalid email or password");
  }

  // 3. Issue tokens
  const { accessToken, refreshToken } = await issueTokens(
    user.user_id,
    user.email,
  );

  return {
    user: {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      phone: user.phone,
    },
    accessToken,
    refreshToken,
  };
};

// ─── Refresh ──────────────────────────────────────────────────────────────────

export interface RefreshResult {
  accessToken: string;
}

/**
 * Verifies the refresh token hash against the DB row for this user,
 * then issues a new access token. The refresh_token row is left untouched.
 *
 * The refresh token itself (a 320-bit crypto-random value, see
 * generateRefreshToken) is looked up by its hash alone — it doesn't need a
 * still-valid access token to scope the lookup, since the whole point of
 * this call is to renew an access token that has already expired.
 *
 * findUserById is needed to include the real email in the new access token
 * payload, since the refresh_token row doesn't store it.
 */
export const refresh = async (
  rawRefreshToken: string,
): Promise<RefreshResult> => {
  const token_hash = hashRefreshToken(rawRefreshToken);

  // Validates hash match AND expires_at > NOW()
  const tokenRow = await findRefreshTokenByHash(token_hash);

  if (!tokenRow) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  // Look up email for the access token payload
  const user = await findUserById(tokenRow.user_id);

  if (!user) {
    throw new ApiError(401, "User not found");
  }

  const accessToken = signUserAccessToken({
    user_id: tokenRow.user_id,
    email: user.email,
  });

  return { accessToken };
};

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * Deletes the specific refresh_token row matching (user_id, token_hash).
 * user_id comes from req.user (authenticate middleware).
 * Silently succeeds even if the token is already gone — idempotent.
 */
export const logout = async (
  user_id: number,
  rawRefreshToken: string,
): Promise<void> => {
  const token_hash = hashRefreshToken(rawRefreshToken);
  await deleteRefreshToken(user_id, token_hash);
};
