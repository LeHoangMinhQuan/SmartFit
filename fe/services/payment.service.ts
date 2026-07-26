import api from "../lib/axios";

interface VNPayUrlResult {
  paymentUrl: string;
  vnpay_txn_ref: string;
}

export const paymentService = {
  createVNPayUrl: (order_id: number) =>
    api
      .post<{ data: VNPayUrlResult }>("/payments/vnpay/create", { order_id })
      .then((r) => r.data.data),
};
