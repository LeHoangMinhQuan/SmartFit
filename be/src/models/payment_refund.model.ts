import db from "../config/db.js";

export type RefundStatus = "pending" | "success" | "failed";

export interface PaymentRefund {
  refund_id?: number;
  order_id: number;
  transaction_id: number;
  vnpay_refund_txn_no?: string | null;
  vnpay_response_code?: string | null;
  amount: number;
  reason?: string | null;
  status: RefundStatus;
  requested_by_staff_id?: number | null;
}

export async function createRefund(
  data: Omit<PaymentRefund, "refund_id">,
): Promise<number> {
  const [row] = await db("payment_refund").insert(data).returning("refund_id");
  return row.refund_id;
}

export async function findRefundByOrderId(order_id: number) {
  return db("payment_refund")
    .where({ order_id })
    .orderBy("refund_id", "desc")
    .first();
}
