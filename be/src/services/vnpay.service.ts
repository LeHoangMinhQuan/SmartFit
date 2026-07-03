import crypto from "crypto";
import qs from "qs";
import db from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import * as OrderModel from "../models/order.model.js";
import * as PaymentModel from "../models/payment_transaction.model.js";
import { env } from "../config/env.js";

// ─── VNPay config (read from env via config/vnpay.ts convention) ──────────────
const { VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_URL, VNPAY_RETURN_URL } = env;

function sortObject(obj: Record<string, any>) {
  return Object.keys(obj)
    .sort()
    .reduce((sorted: Record<string, any>, key) => {
      sorted[key] = obj[key];
      return sorted;
    }, {});
}

function hmacSHA512(secret: string, data: string) {
  return crypto.createHmac("sha512", secret).update(data).digest("hex");
}

// ─── Create payment URL ───────────────────────────────────────────────────────

export async function createPaymentUrl(
  order_id: number,
  user_id: number,
  ip: string,
) {
  const order = await OrderModel.findOrderByIdAndUser(order_id, user_id);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.status !== "pending_payment")
    throw new ApiError(400, "Order is not awaiting payment");

  const vnpay_txn_ref = `${order_id}-${Date.now()}`;
  const amount = Math.round(Number(order.total_amount) * 100); // VNPay expects amount × 100

  // Insert pending transaction
  await PaymentModel.createTransaction({
    order_id,
    vnpay_txn_ref,
    vnpay_amount: Number(order.total_amount),
    status: "pending",
  });

  const createDate = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 14);

  const params: Record<string, string> = {
    vnpay_Version: "2.1.0",
    vnpay_Command: "pay",
    vnpay_TmnCode: VNPAY_TMN_CODE,
    vnpay_Amount: String(amount),
    vnpay_CurrCode: "VND",
    vnpay_TxnRef: vnpay_txn_ref,
    vnpay_OrderInfo: `Payment for order ${order_id}`,
    vnpay_OrderType: "other",
    vnpay_ReturnUrl: VNPAY_RETURN_URL,
    vnpay_IpAddr: ip,
    vnpay_CreateDate: createDate,
    vnpay_Locale: "vn",
  };

  const sorted = sortObject(params);
  const signData = qs.stringify(sorted, { encode: false });
  sorted["vnpay_SecureHash"] = hmacSHA512(VNPAY_HASH_SECRET, signData);

  const paymentUrl = `${VNPAY_URL}?${qs.stringify(sorted, { encode: false })}`;
  return { paymentUrl, vnpay_txn_ref };
}

// ─── IPN Handler ─────────────────────────────────────────────────────────────
// MUST respond with { RspCode, Message } — never call next(err) here.

export async function handleIpn(
  body: Record<string, string>,
): Promise<{ RspCode: string; Message: string }> {
  const { vnpay_SecureHash, ...rest } = body;

  // 1. Verify signature
  const sorted = sortObject(rest);
  const signData = qs.stringify(sorted, { encode: false });
  const expectedHash = hmacSHA512(VNPAY_HASH_SECRET, signData);

  if (expectedHash !== vnpay_SecureHash) {
    return { RspCode: "97", Message: "Invalid signature" };
  }

  const vnpay_txn_ref: string = body["vnpay_TxnRef"] as string;
  const existing = await PaymentModel.findTransactionByRef(vnpay_txn_ref);

  if (!existing) {
    return { RspCode: "01", Message: "Transaction not found" };
  }

  // 2. Idempotency — already processed
  if (existing.status !== "pending") {
    return { RspCode: "00", Message: "Already processed" };
  }

  const isSuccess =
    body["vnpay_ResponseCode"] === "00" &&
    body["vnpay_TransactionStatus"] === "00";
  const newStatus: "success" | "failed" = isSuccess ? "success" : "failed";

  // 3. Update transaction + order in a transaction
  await db.transaction(async (trx) => {
    await trx("payment_transaction")
      .where({ vnpay_txn_ref, status: "pending" })
      .update({
        status: newStatus,
        vnpay_bank_code: body["vnpay_BankCode"] ?? null,
        vnpay_pay_date: body["vnpay_PayDate"] ?? null,
        vnpay_transaction_no: body["vnpay_TransactionNo"] ?? null,
        vnpay_response_code: body["vnpay_ResponseCode"],
      });

    const order_id = existing.order_id;
    const orderStatus = isSuccess ? "paid" : "payment_failed";
    await trx('"ORDER"')
      .where({ order_id })
      .update({ status: orderStatus, updated_at: db.fn.now() });
  });

  // 4. If paid, trigger GHN shipment creation asynchronously (non-blocking)
  if (isSuccess) {
    const order_id = existing.order_id;
    setImmediate(async () => {
      try {
        const { createShipmentForOrder } = await import("./ghn.service.js");
        await createShipmentForOrder(order_id);
      } catch (err) {
        console.error(
          `[IPN] GHN shipment creation failed for order ${order_id}:`,
          err,
        );
      }
    });
  }

  return { RspCode: "00", Message: "Confirmed" };
}
