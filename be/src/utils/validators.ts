/**
 * utils/validators.ts
 *
 * NOTE (2026-08-02): added after a GHN shipment creation failure traced
 * back to a phone number that passed every existing check
 * (`.length(10).regex(/^\d+$/)`) but isn't a real Vietnamese number —
 * "0123456789" is exactly 10 digits, all-digits, and still garbage. That
 * shallow check existed in five different schema files (auth, order,
 * user ×3), all independently under-validating the same way. Centralized
 * here so there's exactly one regex to keep correct/current, not five
 * copies that can drift.
 *
 * Pattern source: current (2025/2026) Vietnamese carrier prefix
 * allocations under Telecom Law 24/2023/QH15 / Decree 163/2024/ND-CP —
 * Viettel (032-039, 096-098), Vinaphone (081-085, 088, 091, 094),
 * MobiFone (070, 076-079, 089, 090, 093), Vietnamobile/Reddi (052, 056,
 * 058, 059). Ranges shift occasionally as the ministry reallocates
 * blocks — if a real, currently-active number ever gets rejected by
 * this, that's the first thing to re-check, not assume the number is
 * fake.
 *
 * This validates *format* only — it cannot confirm the number is
 * actually reachable/in-service. GHN's own validation at shipment
 * creation is still the final authority; this just catches the obvious
 * garbage class (sequential digits, wrong prefix, wrong length) before
 * it gets anywhere near GHN, an email, or a database row.
 */
export const VN_PHONE_REGEX =
  /^0(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-4689])[0-9]{7}$/;

export const VN_PHONE_ERROR_MESSAGE =
  "Enter a valid Vietnamese phone number (e.g. 0912345678)";

/**
 * NOTE (2026-08-02): RegisterModal.tsx's hint text has always advertised
 * "upper & lowercase letters, at least one number" for passwords, but
 * nothing ever actually enforced that — not the frontend (fixed
 * alongside this), and not here either, where registerSchema/
 * resetPasswordSchema/changePasswordSchema all just had `.min(8)`. A
 * password like "aaaaaaaa" passed every one of them. Frontend validation
 * is UX sugar; this is the actual gate — someone hitting the API
 * directly (or a future different frontend) would otherwise still be
 * able to create/set a password the UI claims isn't allowed.
 */
export const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const PASSWORD_ERROR_MESSAGE =
  "Must be 8+ characters with upper & lowercase letters and a number";
