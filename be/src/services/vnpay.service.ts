import type { ReturnQueryFromVNPay, RefundResponse } from "vnpay";
import { RefundTransactionType, dateFormat, getDateInGMT7 } from "vnpay";
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
      // BUG FIX (same root cause as reconcilePendingOrder's queryDr call):
      // both fields need the SDK's dateFormat(getDateInGMT7(...)) output
      // (a yyyyMMddHHmmss number), not .getTime()'s raw millisecond
      // epoch — confirmed against the installed vnpay SDK's source.
      // These two fields also aren't interchangeable even once formatted
      // correctly: vnp_TransactionDate must be the ORIGINAL payment's
      // create date ("giống vnp_CreateDate của vnp_Command=pay" per the
      // SDK's own type doc — i.e. the transaction being refunded, not
      // the refund itself), while vnp_CreateDate is genuinely "now" (the
      // refund *request's* own timestamp). Using `now` for both, as
      // before, was wrong on both counts for vnp_TransactionDate.
      vnp_TransactionDate: dateFormat(
        getDateInGMT7(new Date(transaction.created_at ?? now)),
      ),
      vnp_CreateDate: dateFormat(getDateInGMT7(now)),
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

  // Left as 'refund_requested' on failure — this function (not
  // adminUpdateStatus/VALID_TRANSITIONS, see that table's comment on the
  // 'refund_requested' entry) is the only path that ever sets 'refunded',
  // so staff can just retry Process Refund from the dashboard; the order
  // can't get stuck in an unreachable state.
  return {
    status: "failed",
    message: result.vnp_Message ?? "VNPay declined the refund request",
  };
}

// UPDATE (2026-08-09): the "IMPORTANT — verify against your sandbox" note
// below turned out to be exactly the right caution — real-world testing
// surfaced a bug it warned about. This environment now has the `vnpay`
// package's installed source available (node_modules/vnpay/dist), which
// confirms queryDr's `isSuccess` field reflects vnp_ResponseCode === "00"
// — i.e. whether the QUERY resolved at all, not whether the underlying
// PAYMENT succeeded. The original code below treated `isSuccess === false`
// (any non-"00" response code) as a definitive payment failure; in
// practice this fired on response code "91" ("Không tìm thấy giao dịch
// yêu cầu" / transaction not found) for an order the customer had, in
// fact, just paid — VNPay's own querydr records simply hadn't caught up
// yet. That wrongly flipped the order to 'payment_failed' — the "UI shows
// payment successful but order status is payment_failed" bug. Fixed by
// gating on vnp_ResponseCode explicitly: only "00" (query found the
// transaction) is treated as answering the question at all; every other
// code is now inconclusive-and-left-alone, same as an outright error was
// already handled. See the response-code check right after `queryDr(...)`
// below.
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
// It's wrapped so a wrong assumption here fails safe: any error, or any
// response this code can't clearly read as success or failure, leaves the
// transaction alone and lets expireStalePendingOrders() fall through to
// its existing cancel-on-timeout behavior — exactly what happens today
// without this function. It cannot make things worse than the current
// behavior, only better.
export async function reconcilePendingOrder(order_id: number): Promise<void> {
  try {
    const transaction = await PaymentModel.findTransactionByOrderId(order_id);
    if (!transaction || transaction.status !== "pending") return;

    const createDate = new Date(transaction.created_at ?? Date.now());
    // BUG FIX: vnp_TransactionDate/vnp_CreateDate must be a
    // yyyyMMddHHmmss-formatted number in GMT+7 — confirmed against the
    // installed vnpay SDK's own source (node_modules/vnpay/dist): its
    // buildPaymentUrl() generates vnp_CreateDate internally as exactly
    // `dateFormat(getDateInGMT7())`. This previously passed
    // `createDate.getTime()` — a raw millisecond-since-epoch number
    // (e.g. 1754730957088) — which looks superficially like a valid
    // number but means nothing as a yyyyMMddHHmmss date to VNPay. That's
    // the actual root cause of queryDr returning "Không tìm thấy giao
    // dịch yêu cầu" (response code 91, transaction not found) for
    // payments that had, in fact, gone through — VNPay simply couldn't
    // parse the date field at all. See the response-code handling below,
    // which (as of the previous fix) already treats a non-"00" queryDr
    // response as inconclusive rather than a definitive failure — but
    // with THIS fix, queryDr should now actually find genuine
    // transactions and confirm them as paid instead of staying
    // inconclusive/stuck in 'pending_payment' forever.
    const vnpDate = dateFormat(getDateInGMT7(createDate));
    const queryResult = await vnpayClient.queryDr({
      vnp_RequestId: `reconcile-${transaction.transaction_id}-${Date.now()}`,
      vnp_TxnRef: transaction.vnpay_txn_ref,
      vnp_OrderInfo: `Reconcile order ${order_id}`,
      vnp_TransactionDate: vnpDate,
      vnp_CreateDate: vnpDate,
      vnp_IpAddr: "127.0.0.1",
      vnp_TransactionNo: Number(transaction.vnpay_transaction_no) || 0,
    } as any);

    console.log(
      `[reconcile] order ${order_id} queryDr raw response:`,
      queryResult,
    );

    const result = queryResult as any;

    // BUG FIX (found via a report of "UI shows payment successful but
    // order ends up payment_failed"): vnp_ResponseCode is the status of
    // the QUERY ITSELF, not of the underlying payment — confirmed against
    // the installed vnpay SDK's own source (node_modules/vnpay/dist,
    // queryDr()): `isSuccess: responseData.vnp_ResponseCode === "00"`.
    // Only when the query resolves with code "00" does VNPay return a
    // real vnp_TransactionStatus to describe the payment's actual
    // outcome. Any other code — most commonly "91" ("Không tìm thấy giao
    // dịch yêu cầu" / transaction not found, which is what actually
    // happened here) — means the query itself was inconclusive: often
    // because VNPay hasn't recorded/propagated the transaction yet, not
    // because the payment failed. The previous code treated
    // `result.isSuccess === false` (i.e. any non-"00" response code,
    // "not found" included) as a *definitive payment failure* and called
    // applyPaymentResult(..., false, ...) — which is exactly how a
    // customer who paid seconds before this ran got their order flipped
    // to 'payment_failed' out from under them.
    const responseCode = String(result?.vnp_ResponseCode ?? "");
    if (responseCode !== "00") {
      console.log(
        `[reconcile] order ${order_id} queryDr response code "${responseCode}" ` +
          `("${result?.vnp_Message ?? "no message"}") — the query itself was ` +
          `inconclusive, not a payment failure signal. Leaving the transaction ` +
          `pending for now; a later reconcile pass or the timeout sweep will ` +
          `revisit it.`,
      );
      return;
    }

    // Query succeeded and found the transaction — now vnp_TransactionStatus
    // is meaningful: "00" = paid, "01" = VNPay's own "not yet completed",
    // anything else = a genuine decline/failure.
    const isSuccess = result?.vnp_TransactionStatus === "00";
    const isDefinitiveFailure =
      typeof result?.vnp_TransactionStatus === "string" &&
      result.vnp_TransactionStatus !== "00" &&
      result.vnp_TransactionStatus !== "01";

    if (!isSuccess && !isDefinitiveFailure) {
      // Query succeeded but VNPay's own transaction status says "not yet
      // completed" ("01") — still genuinely pending on their side too.
      // Leave it and let the timeout sweep's existing cancel-on-timeout
      // behavior handle it as before.
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
