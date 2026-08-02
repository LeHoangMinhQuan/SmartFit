import axios from "axios";
import bcrypt from "bcryptjs";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
import { firebaseAuth } from "../config/firebase.js";
import { sendMail } from "../config/mailer.js";
import {
  signUserAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from "../utils/jwt.js";
import {
  findUserByEmail,
  findUserById,
  findUserByGoogleId,
  insertUser,
  insertRefreshToken,
  findRefreshTokenByHash,
  deleteRefreshToken,
  deleteAllUserRefreshTokens,
  emailExists,
  updateUserFirebaseUid,
  updateUserPasswordByEmail,
  linkGoogleId,
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

  // 3b. Best-effort mirror into Firebase Auth — only backs the
  // forgot-password flow (see forgotPassword() below), so a failure here
  // (e.g. Firebase not configured in this environment) must never block
  // registration itself.
  try {
    const fbUser = await firebaseAuth().createUser({
      email: user.email,
      password: body.password,
      displayName: user.username,
    });
    await updateUserFirebaseUid(user.user_id, fbUser.uid);
  } catch (err) {
    console.warn(
      `[auth] Could not create Firebase user for ${user.email}:`,
      err instanceof Error ? err.message : err,
    );
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

// ─── Google sync ──────────────────────────────────────────────────────────────
//
// NOTE (2026-08-01): Google login goes through NextAuth entirely on the
// frontend (see the /api/auth rename in app.ts's mount comment) — it was
// never bridged into this backend's own USER table or JWT/cookie auth at
// all. A Google-authenticated visitor had a valid NextAuth session but no
// USER row and no accessToken/refreshToken cookies, so every
// backend-authenticated feature (orders, wishlist, addresses, profile,
// chat) 401'd for them, and they never appeared in admin's new-user
// counts since nothing ever inserted a USER row for them.
//
// Called by a Next.js server-side route (app/api/sync-google-user) right
// after a Google sign-in resolves — NOT reachable from the browser
// directly, see the controller's auth check.
export interface SyncGoogleUserResult {
  user: {
    user_id: number;
    username: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export const syncGoogleUser = async (body: {
  email: string;
  google_id: string;
  username: string;
  avatar_url: string | null;
}): Promise<SyncGoogleUserResult> => {
  let user = await findUserByGoogleId(body.google_id);

  if (!user) {
    // Not linked yet — if an account with this email already exists
    // (e.g. they originally registered with a password), link Google to
    // it rather than creating a duplicate account. Trusting email-match
    // here is reasonable since Google itself only issues sessions for
    // verified email addresses.
    const existing = await findUserByEmail(body.email);
    if (existing) {
      await linkGoogleId(existing.user_id, body.google_id, body.avatar_url);
      user = {
        ...existing,
        google_id: body.google_id,
        avatar_url: body.avatar_url,
      };
    } else {
      const [created] = await insertUser({
        username: body.username,
        email: body.email,
        password_hash: null, // Google-only account — no password set
        phone: null, // Google doesn't provide one; profile page can collect it later
        google_id: body.google_id,
        avatar_url: body.avatar_url,
      });
      if (!created) throw new ApiError(500, "Failed to create user");
      user = created;
    }
  }

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
      avatar_url: user.avatar_url,
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

// ─── Forgot / Reset password (Firebase-backed) ───────────────────────────────
//
// Login itself stays entirely on Postgres + our own JWTs — Firebase is used
// purely as a secure "prove you own this email" mechanism:
//
//   1. forgotPassword(email) generates a Firebase password-reset link
//      (Firebase mints + signs an oobCode, and will expire/consume it for
//      us) and emails it out ourselves via SMTP.
//   2. The link points at our own /reset-password page (not a Firebase-
//      hosted one), so the user never leaves our UI.
//   3. resetPassword(oobCode, newPassword) posts straight to Google's
//      Identity Toolkit REST API to redeem the oobCode server-side. This
//      both verifies the code (correct signature, not expired, not
//      already used) AND updates the password on the Firebase side, and
//      hands back the email address it belonged to — so this call can't
//      be spoofed into resetting an arbitrary account. We then hash the
//      same new password into Postgres's password_hash, since that's what
//      login() actually checks.

/**
 * Requests a password reset email. Always resolves without throwing when
 * the email simply isn't registered — same anti-enumeration reasoning as
 * login(). Only throws if the reset mechanism itself is broken (Firebase/
 * SMTP not configured, or the send failed), which is worth surfacing.
 */
export const forgotPassword = async (email: string): Promise<void> => {
  const user = await findUserByEmail(email);
  if (!user) return;

  let resetLink: string;
  try {
    resetLink = await firebaseAuth().generatePasswordResetLink(email, {
      // handleCodeInApp means the link points straight at our own page
      // with ?mode=resetPassword&oobCode=... in the query string, instead
      // of a Firebase-hosted confirmation page.
      url: `${env.FRONTEND_URL}/reset-password`,
      handleCodeInApp: true,
    });
  } catch (err) {
    console.error(
      `[auth] Failed to generate a Firebase reset link for ${email}:`,
      err instanceof Error ? err.message : err,
    );
    throw new ApiError(
      500,
      "Could not start password reset right now. Please try again later.",
    );
  }

  try {
    await sendMail({
      to: email,
      subject: "Reset your SmartFit password",
      html: `
        <p>Hi ${user.username},</p>
        <p>We received a request to reset your SmartFit password. This link expires in 1 hour and can only be used once.</p>
        <p><a href="${resetLink}">Reset your password</a></p>
        <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
      `,
    });
  } catch (err) {
    console.error(
      `[auth] Failed to send reset email to ${email}:`,
      err instanceof Error ? err.message : err,
    );
    throw new ApiError(
      500,
      "Could not send the reset email right now. Please try again later.",
    );
  }
};

/**
 * Completes a password reset. `oobCode` is redeemed directly against
 * Google's Identity Toolkit REST API (server-side, using the public Web
 * API key) — this is the step that actually validates the code, so an
 * invalid/expired/already-used code throws a 400 here rather than us
 * having to reimplement that verification ourselves.
 */
export const resetPassword = async (
  oobCode: string,
  newPassword: string,
): Promise<void> => {
  const apiKey = env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    throw new ApiError(500, "Password reset is not configured.");
  }

  let email: string;
  try {
    const { data } = await axios.post<{ email: string }>(
      `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${apiKey}`,
      { oobCode, newPassword },
    );
    email = data.email;
  } catch {
    throw new ApiError(
      400,
      "This reset link is invalid or has expired. Request a new one.",
    );
  }

  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await updateUserPasswordByEmail(email, password_hash);

  // Force re-login everywhere — a leaked/old session shouldn't survive a
  // password reset.
  const user = await findUserByEmail(email);
  if (user) await deleteAllUserRefreshTokens(user.user_id);
};
