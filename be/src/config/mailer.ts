/**
 * config/mailer.ts
 *
 * Firebase's Admin SDK will *generate* a password-reset link, but it will
 * not send an email on our behalf (that's only true of the client-side
 * sendPasswordResetEmail() call, which needs the user to already have an
 * active Firebase-authenticated session — not our situation here, since
 * our real source of truth for login is Postgres + our own JWTs).
 * So: plain SMTP via nodemailer, same "lazy + optional" pattern as
 * config/firebase.ts.
 */
import nodemailer, { Transporter } from "nodemailer";
import { env } from "./env.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "[mailer] SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS must all be set " +
        "to send password reset emails. See ecommerce-api-plan.md for setup.",
    );
  }

  const port = Number(SMTP_PORT);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587/25 use STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const from = env.SMTP_FROM || env.SMTP_USER;
  await getTransporter().sendMail({ from, ...opts });
}
