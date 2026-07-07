import api from "../lib/axios";

export const paymentService = {
  // Returns the VNPay redirect URL. After calling this, redirect the user to
  // paymentUrl via window.location.href. Do NOT do any DB work on the return
  // URL — the IPN endpoint is authoritative.
  createVNPayUrl: (order_id: number) =>
    api
      .post<{ paymentUrl: string }>("/payments/vnpay/create", { order_id })
      .then((r) => r.data),
};
