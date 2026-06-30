import db from "../config/db.js";

export type PaymentStatus = "pending" | "success" | "failed";

export interface PaymentTransaction {
  transaction_id?: number; // IDENTITY
  order_id: number;
  vnp_txn_ref: string; // UNIQUE — format: `${order_id}-${Date.now()}`
  vnp_amount: number;
  vnp_bank_code?: string;
  vnp_pay_date?: string;
  vnp_transaction_no?: string;
  vnp_response_code?: string;
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

export async function findTransactionByRef(vnp_txn_ref: string) {
  return db("payment_transaction").where({ vnp_txn_ref }).first();
}

export async function findTransactionByOrderId(order_id: number) {
  return db("payment_transaction")
    .where({ order_id })
    .orderBy("transaction_id", "desc")
    .first();
}

/**
 * Idempotent IPN update — only writes if status is still 'pending'.
 * Returns number of rows affected (0 = already processed).
 */
export async function confirmTransaction(
  vnp_txn_ref: string,
  update: {
    status: PaymentStatus;
    vnp_bank_code: string;
    vnp_pay_date: string;
    vnp_transaction_no: string;
    vnp_response_code: string;
  },
): Promise<number> {
  return db("payment_transaction")
    .where({ vnp_txn_ref, status: "pending" })
    .update(update);
}
