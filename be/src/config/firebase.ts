/**
 * config/firebase.ts
 *
 * Lazily initialises the Firebase Admin SDK. Only used by the
 * forgot-password flow (services/auth.service.ts):
 *   - firebaseAuth().createUser(...)               — mirror a new Postgres
 *     user into Firebase at registration time, so a reset link can later
 *     be generated for them.
 *   - firebaseAuth().generatePasswordResetLink(...) — mint the actual
 *     reset link we email out. Firebase verifies/expires the link's
 *     oobCode for us; we still send the email ourselves (see mailer.ts)
 *     and still own password_hash in Postgres (see auth.service.ts).
 *
 * Deliberately lazy + not wired into env.ts's hard-required list: the rest
 * of the app (login, cart, orders, try-on, etc.) must keep working even on
 * a machine that never configured Firebase. Only calling firebaseAuth()
 * without credentials set throws — and only for whoever hit "forgot
 * password" at that moment.
 */
import admin from "firebase-admin";
import { env } from "./env.js";

let app: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App {
  if (app) return app;

  const projectId = env.FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  // Service-account private keys are stored in .env with literal "\n"
  // escape sequences (real newlines break most .env parsers) — unescape
  // them back into real newlines before handing to the SDK.
  const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "[firebase] FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY " +
        "must all be set to use password reset. See ecommerce-api-plan.md for setup.",
    );
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
  return app;
}

/** Firebase Auth instance — throws if Firebase env vars aren't configured. */
export function firebaseAuth(): admin.auth.Auth {
  return getFirebaseApp().auth();
}
