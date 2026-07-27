import type { ReturnQueryFromVNPay } from "vnpay";
import db from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import * as OrderModel from "../models/order.model.js";
import * as PaymentModel from "../models/payment_transaction.model.js";
import { vnpayClient, buildTxnRef, buildPaymentUrl } from "../config/vnpay.js";

// TODO(remove for production): VNPay sandbox merchant account only has the
// NCB test bank enabled, so we force-select it here to skip the bank-picker
// page (which was erroring with "bank not supported" / "order not existing"
// when left to auto-select). Remove this once real banks are enabled, or
// make it configurable via env if you need to test other banks.

// ─── Create payment URL ───────────────────────────────────────────────────────

export async function createPaymentUrl(
  order_id: number,
  user_id: number,
  ip: string,
) {
  const order = await OrderModel.findOrderByIdAndUser(order_id, user_id);
  console.log("In vnpay.ts, createPaymentUrl()")
  console.log("order: ", order)
  console.log("user_id: ", user_id)
  console.log("ip: ", ip)
  if (!order) throw new ApiError(404, "Order not found");
  if (order.status !== "pending_payment")
    throw new ApiError(400, "Order is not awaiting payment");

  const vnpay_txn_ref = buildTxnRef(order_id);
  console.log("vnpay_txn_ref: ", vnpay_txn_ref)
  const amount = Number(order.total_amount); // raw amount — SDK handles ×100 internally

  // Insert pending transaction
  await PaymentModel.createTransaction({
    order_id,
    vnpay_txn_ref,
    vnpay_amount: amount,
    status: "pending",
  });

  const paymentUrl = buildPaymentUrl({
    txnRef: vnpay_txn_ref,
    amount,
    orderInfo: `Payment for order ${order_id}`,
    ipAddr: ip,
  });
  console.log("paymentUrl: ", paymentUrl)

  return { paymentUrl, vnpay_txn_ref };
}

// ─── IPN Handler ─────────────────────────────────────────────────────────────
// MUST respond with { RspCode, Message } — never call next(err) here.

export async function handleIpn(
  body: Record<string, string>,
): Promise<{ RspCode: string; Message: string }> {
  // 1. Verify signature + integrity via the SDK. VNPay's server-to-server
  //    callback always arrives with vnp_-prefixed fields — that's their wire
  //    contract, independent of our internal vnpay_ naming convention — so we
  //    hand the raw body straight to the SDK rather than reading vnpay_* keys.
  const verify = vnpayClient.verifyIpnCall(
    body as unknown as ReturnQueryFromVNPay,
  );

  console.log("In vnpay.ts, handleIpn()")
  console.log("body: ", body)


  if (!verify.isVerified) {
    return { RspCode: "97", Message: "Invalid signature" };
  }

  const vnpay_txn_ref = String(verify.vnp_TxnRef);
  console.log("vnpay_txn_ref: ", vnpay_txn_ref)
  const existing = await PaymentModel.findTransactionByRef(vnpay_txn_ref);
  console.log("existing: ", existing)
  if (!existing) {
    return { RspCode: "01", Message: "Transaction not found" };
  }

  // 2. Idempotency — already processed
  if (existing.status !== "pending") {
    return { RspCode: "00", Message: "Already processed" };
  }

  const isSuccess = verify.isSuccess; // SDK checks vnp_ResponseCode === "00"
  const newStatus: "success" | "failed" = isSuccess ? "success" : "failed";

  // 3. Update transaction + order — translate the verified vnp_* wire fields
  //    into our internal vnpay_* storage convention
  await db.transaction(async (trx) => {
    await trx("payment_transaction")
      .where({ vnpay_txn_ref, status: "pending" })
      .update({
        status: newStatus,
        vnpay_bank_code: verify.vnp_BankCode ?? null,
        vnpay_pay_date:
          verify.vnp_PayDate != null ? String(verify.vnp_PayDate) : null,
        vnpay_transaction_no:
          verify.vnp_TransactionNo != null
            ? String(verify.vnp_TransactionNo)
            : null,
        vnpay_response_code: String(verify.vnp_ResponseCode),
      });
    console.log("existing.order_id: ", existing.order_id)
    const order_id = existing.order_id;
    const orderStatus = isSuccess ? "paid" : "payment_failed";
    await trx("ORDER")
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
