import api from "../lib/axios";
import type { Order, PaginatedResponse } from "../interfaces";

interface CreateOrderBody {
  payment_method_id: number;
  shipping_address: string; // VARCHAR(70) — denormalized, validated before submit
  ward_id: number;
  voucher_id?: number;
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
