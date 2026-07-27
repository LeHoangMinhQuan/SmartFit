/**
 * config/vnpay.ts
 *
 * Initialises the VNPay SDK client and exports helpers used by
 * vnpay.service.ts.
 *
 * Sandbox:    https://sandbox.vnpayment.vn
 * Production: https://pay.vnpay.vn
 *
 * Docs: https://sandbox.vnpayment.vn/apis/docs/huong-dan-tich-hop/
 *
 * TODO (production checklist):
 *   - Set testMode: false
 *   - Set vnpayHost to 'https://pay.vnpay.vn'
 *   - Ensure VNPAY_RETURN_URL and VNPAY_IPN_URL point to live HTTPS endpoints
 *   - Rotate VNPAY_HASH_SECRET and store it in a secrets manager
 */

import {
  VNPay,
  HashAlgorithm,
  ignoreLogger,
  ProductCode,
  VnpLocale,
} from "vnpay";
import { env } from "./env.js";

// ── Client ────────────────────────────────────────────────────────────────────

export const vnpayClient = new VNPay({
  tmnCode: env.VNPAY_TMN_CODE,
  secureSecret: env.VNPAY_HASH_SECRET,
  vnpayHost: "https://sandbox.vnpayment.vn",
  testMode: env.NODE_ENV !== "production",
  hashAlgorithm: HashAlgorithm.SHA512,
  enableLog: env.NODE_ENV === "development",
  loggerFn: ignoreLogger,
});

// ── Constants re-exported for use in services ─────────────────────────────────

export { ProductCode, VnpLocale };

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Parameters passed to vnpayService.buildPaymentUrl().
 * These map 1-to-1 to VNPay's vnpay_* query parameters.
 */
export interface BuildPaymentUrlParams {
  /** Unique reference per calendar day — use `${orderId}-${Date.now()}` */
  txnRef: string;
  /** Order total in VND (raw integer — SDK handles ×100 internally) */
  amount: number;
  /** Short description shown on the VNPay payment page */
  orderInfo: string;
  /** Client IP address from req.ip */
  ipAddr: string;
  /** Optional: pre-select bank code (e.g. 'NCB') */
  bankCode?: string;
  /** UI locale — defaults to Vietnamese */
  locale?: VnpLocale;
}

/**
 * Parsed fields from a VNPay IPN / return-URL callback.
 * Only the fields we store in `payment_transaction` are listed.
 */
export interface VnpCallbackParams {
  vnpay_TxnRef: string;
  vnpay_Amount: string;
  vnpay_BankCode: string;
  vnpay_PayDate: string;
  vnpay_TransactionNo: string;
  vnpay_ResponseCode: string;
  vnpay_SecureHash: string;
  [key: string]: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return URL where VNPay redirects the user after payment */
export const VNPAY_RETURN_URL = env.VNPAY_RETURN_URL;

/** IPN endpoint that VNPay calls server-to-server */
export const VNPAY_IPN_URL = env.VNPAY_IPN_URL;

/**
 * Build a unique vnpay_TxnRef for a given order.
 * Must be unique within the same calendar day.
 */
export function buildTxnRef(orderId: number): string {
  return `${orderId}-${Date.now()}`;
}

/**
 * VNPay's `vnp_IpAddr` field is spec'd as Alphanumeric and every official
 * example uses plain IPv4 (e.g. 127.0.0.1). In dev/sandbox, `req.ip` often
 * comes back as an IPv6 address (e.g. `::1`, `::ffff:127.0.0.1`, or a real
 * IPv6 address like `2001:ee0:...`). Sending that raw to VNPay causes their
 * server-side checksum recomputation to diverge from ours (the colons get
 * stripped/rejected on their end), which surfaces as "Sai chữ ký" even
 * though our own HMAC is internally correct.
 *
 * This normalizes IPv6-mapped IPv4 addresses (`::ffff:x.x.x.x` → `x.x.x.x`)
 * and falls back to `127.0.0.1` for `::1` or any other pure-IPv6 address,
 * which is fine for sandbox testing (VNPay doesn't validate the IP is real).
 */
export function normalizeIpForVnpay(rawIp: string): string {
  if (rawIp === "::1") return "127.0.0.1";
  const ipv4MappedMatch = rawIp.match(
    /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/,
  );
  if (ipv4MappedMatch) return ipv4MappedMatch[1]!;
  const isIpv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(rawIp);
  if (isIpv4) return rawIp;
  // Pure IPv6, no IPv4 form available — fall back rather than send colons.
  return "127.0.0.1";
}

/**
 * Build the VNPay payment redirect URL via the SDK.
 *
 * This is the only place that should speak VNPay's `vnp_*` wire format —
 * everywhere else in the app uses the `vnpay_*` internal convention.
 *
 * Note: pass the raw order amount (not × 100) — the SDK multiplies by 100
 * internally when building the URL.
 */
export function buildPaymentUrl(params: BuildPaymentUrlParams): string {
  return vnpayClient.buildPaymentUrl({
    vnp_Amount: params.amount,
    vnp_TxnRef: params.txnRef,
    vnp_OrderInfo: params.orderInfo,
    vnp_IpAddr: normalizeIpForVnpay(params.ipAddr),
    vnp_ReturnUrl: VNPAY_RETURN_URL,
    vnp_BankCode: params.bankCode,
    vnp_Locale: params.locale ?? VnpLocale.VN,
  });
}

/**
 * Map VNPay response code to a human-readable message.
 * Codes from: https://sandbox.vnpayment.vn/apis/docs/bang-ma-loi/
 */
export function vnpResponseMessage(code: string): string {
  const messages: Record<string, string> = {
    "00": "Giao dịch thành công",
    "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan đến lừa đảo, giao dịch bất thường).",
    "09": "Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking tại ngân hàng.",
    "10": "Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần.",
    "11": "Đã hết hạn chờ thanh toán.",
    "12": "Thẻ/Tài khoản bị khóa.",
    "13": "Sai mật khẩu OTP.",
    "24": "Giao dịch không thành công do: Khách hàng hủy giao dịch.",
    "51": "Tài khoản không đủ số dư để thực hiện giao dịch.",
    "65": "Tài khoản đã vượt quá hạn mức giao dịch trong ngày.",
    "75": "Ngân hàng thanh toán đang bảo trì.",
    "79": "Sai mật khẩu thanh toán quá số lần quy định.",
    "99": "Lỗi không xác định.",
  };
  return messages[code] ?? `Mã lỗi không xác định: ${code}`;
}
