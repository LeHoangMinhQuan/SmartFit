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
 *   - Ensure VNP_RETURN_URL and VNP_IPN_URL point to live HTTPS endpoints
 *   - Rotate VNP_HASH_SECRET and store it in a secrets manager
 */

import { VNPay, ignoreLogger, ProductCode, VnpLocale } from "vnpay";
import env from "./env.js";

// ── Client ────────────────────────────────────────────────────────────────────

export const vnpayClient = new VNPay({
  tmnCode: env.VNP_TMN_CODE,
  secureSecret: env.VNP_HASH_SECRET,
  vnpayHost: "https://sandbox.vnpayment.vn", // TODO: swap for production
  testMode: env.NODE_ENV !== "production",
  hashAlgorithm: "SHA512",
  enableLog: env.NODE_ENV === "development",
  loggerFn: ignoreLogger,
});

// ── Constants re-exported for use in services ─────────────────────────────────

export { ProductCode, VnpLocale };

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Parameters passed to vnpayService.buildPaymentUrl().
 * These map 1-to-1 to VNPay's vnp_* query parameters.
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
  vnp_TxnRef: string;
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_PayDate: string;
  vnp_TransactionNo: string;
  vnp_ResponseCode: string;
  vnp_SecureHash: string;
  [key: string]: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return URL where VNPay redirects the user after payment */
export const VNPAY_RETURN_URL = env.VNP_RETURN_URL;

/** IPN endpoint that VNPay calls server-to-server */
export const VNPAY_IPN_URL = env.VNP_IPN_URL;

/**
 * Build a unique vnp_TxnRef for a given order.
 * Must be unique within the same calendar day.
 */
export function buildTxnRef(orderId: number): string {
  return `${orderId}-${Date.now()}`;
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
