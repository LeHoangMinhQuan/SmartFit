/**
 * lib/validators.ts
 *
 * NOTE (2026-08-02): added after a GHN shipment creation failure traced
 * back to a phone number ("0123456789") that was never actually
 * validated client-side at all — only a backend length/digits-only check
 * existed, and that was too shallow to catch it either (see be's
 * utils/validators.ts, which this mirrors). This is what powers the
 * real-time debounced validation on AddressForm.tsx, RegisterModal.tsx,
 * and the profile page's phone field.
 *
 * Keep this in sync with be/src/utils/validators.ts by hand — fe and be
 * are separate deployables with no shared package, so there's no way to
 * import one definition into both. If you update one, update the other.
 */
export const VN_PHONE_REGEX =
  /^0(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-4689])[0-9]{7}$/;

export const VN_PHONE_ERROR_MESSAGE =
  "Enter a valid Vietnamese phone number (e.g. 0912345678)";

export function isValidVnPhone(phone: string): boolean {
  return VN_PHONE_REGEX.test(phone.trim());
}

// Deliberately basic (RFC 5322 is far too permissive/complex to fully
// replicate here, and HTML5 type="email" already provides a first line
// of defense on submit) — this exists for real-time debounced feedback,
// not as the final word. The email field's real validation authority is
// still the backend's zod z.email() check.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export const PASSWORD_MIN_LENGTH = 8;

// RegisterModal.tsx's hint text has always advertised "upper & lowercase
// letters, at least one number" — but until now nothing actually enforced
// that, backend or frontend (registerSchema was just z.string().min(8)).
// This makes the actual validation match what the UI already promises.
const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const PASSWORD_ERROR_MESSAGE =
  "Must be 8+ characters with upper & lowercase letters and a number";

export function isValidPassword(password: string): boolean {
  return PASSWORD_STRENGTH_REGEX.test(password);
}
