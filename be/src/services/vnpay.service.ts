import type { ReturnQueryFromVNPay, RefundResponse } from "vnpay";
import { RefundTransactionType } from "vnpay";
import db from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import * as OrderModel from "../models/order.model.js";
import * as PaymentModel from "../models/payment_transaction.model.js";
import * as PaymentRefundModel from "../models/payment_refund.model.js";
import { vnpayClient, buildTxnRef, buildPaymentUrl } from "../config/vnpay.js";
import { expireStalePendingOrders } from "./order.service.js";

// TODO(remove for production): VNPay sandbox merchant account only has the
// NCB test bank enabled, so we force-select it here to skip the bank-picker
// page (which was erroring with "bank not supported" / "order not existing"
// when left to auto-select). Remove this once real banks are enabled, or
// make it configurable via env if you need to test other banks.

// ─── Create payment URL ───────────────────────────────────────────────────────

// Orders in either of these states can (re)generate a payment URL:
//   - pending_payment: the normal first-attempt case, or the customer came
//     back to finish a payment they never completed.
//   - payment_failed: VNPay reported a real decline (wrong OTP, insufficient
//     balance, bank cancelled, etc.) — the order's stock is still held, so
//     letting them try again reuses the same order instead of forcing a
//     fresh checkout.
// 'cancelled' orders (whether cancelled by the customer or auto-expired by
// expireStalePendingOrders()) are NOT retryable here — their stock has
// already been released back to the store.
const RETRYABLE_STATUSES = ["pending_payment", "payment_failed"];

export async function createPaymentUrl(
  order_id: number,
  user_id: number,
  ip: string,
) {
  // Catch the case where this specific order just crossed the abandon
  // threshold but the periodic/lazy sweep hasn't run yet — expire it now
  // rather than handing out a payment URL for stock that's about to be (or
  // already was) released to someone else.
  await expireStalePendingOrders();

  const order = await OrderModel.findOrderByIdAndUser(order_id, user_id);
  console.log("In vnpay.ts, createPaymentUrl()");
  console.log("order: ", order);
  console.log("user_id: ", user_id);
  console.log("ip: ", ip);
  if (!order) throw new ApiError(404, "Order not found");
  if (!RETRYABLE_STATUSES.includes(order.status)) {
    throw new ApiError(
      400,
      order.status === "cancelled"
        ? "This order has expired or was cancelled. Please place a new order."
        : "Order is not awaiting payment",
    );
  }

  // Supersede any dangling 'pending' transaction from a previous attempt
  // (e.g. the customer opened the VNPay page but never finished, then came
  // back and retried) so at most one transaction row is ever 'pending' for
  // this order at a time.
  await PaymentModel.failPendingTransactionsForOrder(order_id);

  const vnpay_txn_ref = buildTxnRef(order_id);
  console.log("vnpay_txn_ref: ", vnpay_txn_ref);
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
  console.log("paymentUrl: ", paymentUrl);

  return { paymentUrl, vnpay_txn_ref };
}

// ─── Shared: apply a verified/queried VNPay result ─────────────────────────────
// Used by both handleIpn (server-to-server push) and reconcilePendingOrder
// (pull-based fallback, see below) so "what happens when we learn a
// transaction succeeded or failed" only exists in one place.
async function applyPaymentResult(
  existing: { order_id: number; vnpay_txn_ref: string },
  isSuccess: boolean,
  fields: {
    bankCode?: string | null;
    payDate?: string | null;
    transactionNo?: string | null;
    responseCode?: string | null;
  },
): Promise<void> {
  const newStatus: "success" | "failed" = isSuccess ? "success" : "failed";

  await db.transaction(async (trx) => {
    await trx("payment_transaction")
      .where({ vnpay_txn_ref: existing.vnpay_txn_ref, status: "pending" })
      .update({
        status: newStatus,
        vnpay_bank_code: fields.bankCode ?? null,
        vnpay_pay_date: fields.payDate ?? null,
        vnpay_transaction_no: fields.transactionNo ?? null,
        vnpay_response_code: fields.responseCode ?? null,
      });
    const order_id = existing.order_id;
    const orderStatus = isSuccess ? "paid" : "payment_failed";
    await trx("ORDER")
      .where({ order_id })
      .update({ status: orderStatus, updated_at: db.fn.now() });
  });

  if (isSuccess) {
    const order_id = existing.order_id;
    setImmediate(async () => {
      try {
        const { createShipmentForOrder } = await import("./ghn.service.js");
        await createShipmentForOrder(order_id);
        const { notifyStaffOfConfirmedOrder } =
          await import("./notification.service.js");
        await notifyStaffOfConfirmedOrder(order_id);
      } catch (err) {
        console.error(
          `[payment] GHN shipment creation failed for order ${order_id}:`,
          err,
        );
        const { notifyStaffOfShipmentFailure } =
          await import("./notification.service.js");
        await notifyStaffOfShipmentFailure(order_id, err).catch(() => {});
      }
    });
  }
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

  console.log("In vnpay.ts, handleIpn()");
  console.log("body: ", body);

  if (!verify.isVerified) {
    return { RspCode: "97", Message: "Invalid signature" };
  }

  const vnpay_txn_ref = String(verify.vnp_TxnRef);
  console.log("vnpay_txn_ref: ", vnpay_txn_ref);
  const existing = await PaymentModel.findTransactionByRef(vnpay_txn_ref);
  console.log("existing: ", existing);
  if (!existing) {
    return { RspCode: "01", Message: "Transaction not found" };
  }

  // 2. Idempotency — already processed
  if (existing.status !== "pending") {
    return { RspCode: "00", Message: "Already processed" };
  }

  const isSuccess = verify.isSuccess; // SDK checks vnp_ResponseCode === "00"

  // 3. Update transaction + order (shared with reconcilePendingOrder below)
  await applyPaymentResult(existing, isSuccess, {
    bankCode: verify.vnp_BankCode,
    payDate: verify.vnp_PayDate != null ? String(verify.vnp_PayDate) : null,
    transactionNo:
      verify.vnp_TransactionNo != null
        ? String(verify.vnp_TransactionNo)
        : null,
    responseCode: String(verify.vnp_ResponseCode),
  });

  return { RspCode: "00", Message: "Confirmed" };
}

// ─── Refund ────────────────────────────────────────────────────────────────
//
// Staff-triggered, not automatic — see order.service.ts's cancelOrder():
// cancelling a prepaid order moves it to 'refund_requested' but does NOT
// move any money by itself. This is the function that actually calls
// VNPay's refund API, invoked from the staff dashboard once someone has
// reviewed the request. Deliberately not automatic — a wrong refund is a
// real financial mistake, and giving staff a review step before money
// moves is worth the extra click.
export async function processRefund(
  order_id: number,
  staff_id: number,
  reason?: string,
): Promise<{ status: "success" | "failed"; message: string }> {
  const order = await OrderModel.findOrderById(order_id);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.status !== "refund_requested") {
    throw new ApiError(
      400,
      `Order is '${order.status}', not 'refund_requested' — nothing to refund`,
    );
  }

  // The transaction that was actually charged — the one and only
  // 'success' row for this order. If there isn't one, this order was
  // never really paid via VNPay (shouldn't be reachable given
  // cancelOrder() only routes VNPay orders into 'refund_requested' — see
  // that function's isCOD check — but checked explicitly rather than
  // trusting that invariant blindly, since this is the one place in the
  // codebase that actually moves money back out).
  const transaction = await db("payment_transaction")
    .where({ order_id, status: "success" })
    .orderBy("transaction_id", "desc")
    .first();
  if (!transaction) {
    throw new ApiError(
      409,
      "No successful VNPay transaction found for this order — cannot refund",
    );
  }

  const now = new Date();
  let result: RefundResponse;
  try {
    result = await vnpayClient.refund({
      vnp_RequestId: buildTxnRef(order_id), // unique per request, same pattern as payment creation
      vnp_TransactionType: RefundTransactionType.FULL_REFUND,
      vnp_TxnRef: transaction.vnpay_txn_ref,
      vnp_Amount: Number(transaction.vnpay_amount),
      vnp_OrderInfo: `Refund for order ${order_id}${reason ? `: ${reason}` : ""}`,
      vnp_TransactionNo: Number(transaction.vnpay_transaction_no) || undefined,
      vnp_TransactionDate: now.getTime(),
      vnp_CreateDate: now.getTime(),
      vnp_CreateBy: `staff:${staff_id}`,
      vnp_IpAddr: "127.0.0.1",
    });
  } catch (err) {
    console.error(
      `[refund] VNPay refund call failed for order ${order_id}:`,
      err,
    );
    await PaymentRefundModel.createRefund({
      order_id,
      transaction_id: transaction.transaction_id,
      amount: Number(transaction.vnpay_amount),
      reason: reason ?? null,
      status: "failed",
      requested_by_staff_id: staff_id,
    });
    throw new ApiError(
      502,
      "VNPay refund request failed — order left as 'refund_requested' for retry",
    );
  }

  // isVerified: signature on VNPay's response checks out. isSuccess: the
  // refund itself was accepted (vnp_ResponseCode === "00") — these are
  // two different things and both matter before we trust "refunded".
  const isSuccess = result.isVerified && result.isSuccess;

  await PaymentRefundModel.createRefund({
    order_id,
    transaction_id: transaction.transaction_id,
    vnpay_refund_txn_no:
      result.vnp_TransactionNo != null
        ? String(result.vnp_TransactionNo)
        : null,
    vnpay_response_code:
      result.vnp_ResponseCode != null ? String(result.vnp_ResponseCode) : null,
    amount: Number(transaction.vnpay_amount),
    reason: reason ?? null,
    status: isSuccess ? "success" : "failed",
    requested_by_staff_id: staff_id,
  });

  if (isSuccess) {
    await OrderModel.updateOrderStatus(order_id, "refunded");
    return { status: "success", message: "Refund confirmed by VNPay" };
  }

  // Left as 'refund_requested' — VALID_TRANSITIONS only allows
  // refund_requested -> refunded, so staff can simply retry from the
  // dashboard rather than this landing in some other unreachable state.
  return {
    status: "failed",
    message: result.vnp_Message ?? "VNPay declined the refund request",
  };
}

// ─── Reconciliation (pull-based fallback for missed/undelivered IPNs) ────────
//
// NOTE (2026-08-01): added after tracing "order stuck in pending_payment /
// shows cancelled despite being paid" back to two compounding issues:
//   1. IPN is the *only* path that ever marks an order 'paid' — it's a
//      server-to-server callback VNPay makes to a URL registered in
//      VNPay's merchant portal (VNPAY_IPN_URL is defined in env/config
//      purely as documentation of what should be registered there — it
//      was never actually passed to any VNPay API call in this codebase,
//      so if that portal registration is wrong/stale/unreachable, VNPay
//      simply never calls back and nothing here would ever know).
//   2. expireStalePendingOrders() (order.service.ts) cancels + restores
//      stock for anything still 'pending_payment' after
//      PENDING_PAYMENT_TIMEOUT_MINUTES, purely on elapsed time — it has no
//      way to distinguish "customer abandoned checkout" from "customer
//      paid, but the IPN never arrived" before now.
//
// This calls VNPay's own transaction-query API (queryDr) — the officially
// documented fallback for exactly this scenario — to actually check
// before assuming (1) failed. Called from expireStalePendingOrders() for
// each stale order, just before it would otherwise be cancelled.
//
// IMPORTANT — verify against your sandbox before trusting this in
// production: I don't have the `vnpay` package's installed type
// definitions or network access to its docs site in this environment, so
// the exact field/response shape below is built from the SDK's own
// published example (github.com/lehuygiang28/vnpay, example/index.ts) and
// its verifyIpnCall's `.isSuccess`/`.isVerified` convention for the return
// shape, not a confirmed-working call. It's wrapped so a wrong assumption
// here fails safe: any error, or any response shape that doesn't clearly
// say "success", leaves the transaction alone and lets
// expireStalePendingOrders() fall through to its existing
// cancel-on-timeout behavior — exactly what happens today without this
// function. It cannot make things worse than the current behavior, only
// better once confirmed working. Log output during your first real test
// (a payment where you deliberately block/delay the IPN) will show the
// raw queryDr response — adjust the field reads below to match if they
// don't line up.
export async function reconcilePendingOrder(order_id: number): Promise<void> {
  try {
    const transaction = await PaymentModel.findTransactionByOrderId(order_id);
    if (!transaction || transaction.status !== "pending") return;

    const createDate = new Date(transaction.created_at ?? Date.now());
    const queryResult = await vnpayClient.queryDr({
      vnp_RequestId: `reconcile-${transaction.transaction_id}-${Date.now()}`,
      vnp_TxnRef: transaction.vnpay_txn_ref,
      vnp_OrderInfo: `Reconcile order ${order_id}`,
      vnp_TransactionDate: createDate.getTime(),
      vnp_CreateDate: createDate.getTime(),
      vnp_IpAddr: "127.0.0.1",
      vnp_TransactionNo: Number(transaction.vnpay_transaction_no) || 0,
    } as any);

    console.log(
      `[reconcile] order ${order_id} queryDr raw response:`,
      queryResult,
    );

    const result = queryResult as any;
    // Prefer the SDK's normalized flag if it provides one (matching
    // verifyIpnCall's .isSuccess elsewhere in this file); fall back to
    // VNPay's raw vnp_TransactionStatus ("00" = success per VNPay's spec).
    const isSuccess =
      result?.isSuccess === true || result?.vnp_TransactionStatus === "00";
    const isDefinitiveFailure =
      result?.isSuccess === false ||
      (typeof result?.vnp_TransactionStatus === "string" &&
        result.vnp_TransactionStatus !== "00" &&
        result.vnp_TransactionStatus !== "01"); // "01" = VNPay's own "not yet completed"

    if (!isSuccess && !isDefinitiveFailure) {
      // VNPay itself doesn't have a definitive answer yet either — leave
      // it 'pending' and let the timeout sweep's existing cancel-on-
      // timeout behavior handle it as before.
      return;
    }

    await applyPaymentResult(transaction, isSuccess, {
      bankCode: result?.vnp_BankCode ?? null,
      payDate: result?.vnp_PayDate != null ? String(result.vnp_PayDate) : null,
      transactionNo:
        result?.vnp_TransactionNo != null
          ? String(result.vnp_TransactionNo)
          : null,
      responseCode:
        result?.vnp_ResponseCode != null
          ? String(result.vnp_ResponseCode)
          : null,
    });

    console.log(
      `[reconcile] order ${order_id} recovered via queryDr — marked ${isSuccess ? "paid" : "payment_failed"} instead of being cancelled by the timeout sweep`,
    );
  } catch (err) {
    // Fails safe — see the function doc comment. Never throw: the caller
    // (expireStalePendingOrders) must still proceed to its existing
    // cancel-on-timeout behavior for this order.
    console.error(`[reconcile] queryDr failed for order ${order_id}:`, err);
  }
}
