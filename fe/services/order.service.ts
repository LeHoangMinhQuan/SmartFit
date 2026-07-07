import api from "../lib/axios";
import type { Order, PaginatedResponse } from "../interfaces";

interface CreateOrderBody {
  payment_method_id: number;
  shipping_address: string; // VARCHAR(70) — denormalized, validated before submit
  ward_id: number;
  voucher_id?: number;
}

export const orderService = {
  createOrder: (body: CreateOrderBody) =>
    api.post<{ order_id: number }>("/orders", body).then((r) => r.data),

  getOrders: (params?: { page?: number; limit?: number }) =>
    api
      .get<PaginatedResponse<Order>>("/orders", { params })
      .then((r) => r.data),

  getOrder: (order_id: number) =>
    api.get<Order>(`/orders/${order_id}`).then((r) => r.data),

  // Only allowed when status is 'paid' or 'preparing'
  cancelOrder: (order_id: number) =>
    api.patch(`/orders/${order_id}/cancel`).then((r) => r.data),
};
