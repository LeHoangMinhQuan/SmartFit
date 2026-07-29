import db from "../config/db.js";

export type PaymentStatus = "pending" | "success" | "failed";

export interface PaymentTransaction {
  transaction_id?: number; // IDENTITY
  order_id: number;
  vnpay_txn_ref: string; // UNIQUE — format: `${order_id}-${Date.now()}`
  vnpay_amount: number;
  vnpay_bank_code?: string;
  vnpay_pay_date?: string;
  vnpay_transaction_no?: string;
  vnpay_response_code?: string;
  status: PaymentStatus;
}

export async function createTransaction(
  data: Omit<PaymentTransaction, "transaction_id">,
): Promise<number> {
  const [row] = await db("payment_transaction")
    .insert(data)
    .returning("transaction_id");
  return row.transaction_id;
}

export async function findTransactionByRef(vnpay_txn_ref: string) {
  return db("payment_transaction").where({ vnpay_txn_ref }).first();
}

export async function findTransactionByOrderId(order_id: number) {
  return db("payment_transaction")
    .where({ order_id })
    .orderBy("transaction_id", "desc")
    .first();
}

/**
 * Marks any still-'pending' transaction rows for an order as 'failed'.
 * Used when: (a) a stale pending_payment order is auto-cancelled — its
 * dangling pending transaction (if VNPay's IPN never arrived) shouldn't
 * stay 'pending' forever either; (b) a retry supersedes a previous
 * incomplete attempt before inserting the new one, so at most one
 * transaction row is ever actually 'pending' for a given order at a time.
 */
export async function failPendingTransactionsForOrder(
  order_id: number,
  trx: typeof db = db,
) {
  return trx("payment_transaction")
    .where({ order_id, status: "pending" })
    .update({ status: "failed" });
}

/**
 * Idempotent IPN update — only writes if status is still 'pending'.
 * Returns number of rows affected (0 = already processed).
 */
export async function confirmTransaction(
  vnpay_txn_ref: string,
  update: {
    status: PaymentStatus;
    vnpay_bank_code: string;
    vnpay_pay_date: string;
    vnpay_transaction_no: string;
    vnpay_response_code: string;
  },
): Promise<number> {
  return db("payment_transaction")
    .where({ vnpay_txn_ref, status: "pending" })
    .update(update);
}
