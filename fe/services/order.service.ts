import api from "../lib/axios";
import type { Order, PaginatedResponse } from "../interfaces";

interface CreateOrderBody {
  payment_method_id: number;
  shipping_address: string; // VARCHAR(70) — denormalized, validated before submit
  ward_id: number;
  // Bug fix: was voucher_id, but the backend (order.service.ts,
  // VoucherModel.validateVoucher) only ever reads voucher_code — zod
  // silently strips unrecognized body keys by default, so voucher_id was
  // dropped server-side on every order, meaning the discount shown in the
  // checkout UI was never actually applied to what got charged.
  voucher_code?: string;
  // Bug fix: previously omitted entirely — total_amount on the backend
  // was computed as subtotal minus voucher discount only, silently
  // excluding the delivery fee from every VNPay charge.
  shipping_fee: number;
}

export const orderService = {
  // Backend wraps this in { data: { order_id } } — unwrap fully, or
  // `order_id` destructures as undefined (as it did before this fix).
  createOrder: (body: CreateOrderBody) =>
    api
      .post<{ data: { order_id: number } }>("/orders", body)
      .then((r) => r.data.data),

  // getOrders already returns { data, meta } matching PaginatedResponse
  // at the top level — do not add an extra .data unwrap here.
  getOrders: (params?: { page?: number; limit?: number }) =>
    api
      .get<PaginatedResponse<Order>>("/orders", { params })
      .then((r) => r.data),

  // Backend wraps this in { data: result } too — same fix as createOrder.
  getOrder: (order_id: number) =>
    api.get<{ data: Order }>(`/orders/${order_id}`).then((r) => r.data.data),

  // Only allowed when status is 'paid' or 'preparing'
  cancelOrder: (order_id: number) =>
    api.patch(`/orders/${order_id}/cancel`).then((r) => r.data),
};
