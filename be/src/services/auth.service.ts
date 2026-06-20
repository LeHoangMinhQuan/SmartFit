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
  insertUser,
  insertRefreshToken,
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

  // 3. Insert user
  // user_id is generated automatically by PostgreSQL IDENTITY
  const [user] = await insertUser({
    username: body.username,
    email: body.email,
    password_hash,
    ...(body.phone && { phone: body.phone }),
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
    },
    accessToken,
    refreshToken,
  };
};
