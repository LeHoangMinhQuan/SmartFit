"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService } from "../../../../services/staff/admin.service";
import { formatDate, formatPrice } from "../../../../lib/utils";
import { toast } from "../../../../components/ui/Toast";
import Spinner from "../../../../components/ui/Spinner";
import OrderStatusBadge from "../../../../components/order/OrderStatusBadge";
import type { OrderStatus } from "../../../../interfaces";

const STATUS_OPTIONS: OrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
  "shipping",
  "delivered",
  "cancelled",
  "payment_failed",
  "refund_requested",
  "refunded",
];

export default function StaffOrderDetailPage() {
  const params = useParams<{ order_id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = Number(params.order_id);

  const orderQuery = useQuery({
    queryKey: ["staff-order", orderId],
    queryFn: () => adminService.getOrder(orderId),
  });
  const order = orderQuery.data ?? null;
  const loading = orderQuery.isLoading;

  useEffect(() => {
    if (orderQuery.isError) toast.error("Failed to load order.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderQuery.isError]);

  const updateStatusMutation = useMutation({
    mutationFn: (status: OrderStatus) =>
      adminService.updateOrderStatus(order!.order_id, status),
    onSuccess: (_data, status) => {
      queryClient.setQueryData(["staff-order", orderId], (old: typeof order) =>
        old ? { ...old, status } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["staff-orders"] });
      toast.success("Status updated.");
    },
    onError: () => toast.error("Failed to update status."),
  });
  const updating = updateStatusMutation.isPending;

  async function handleStatusChange(status: OrderStatus) {
    if (!order) return;
    updateStatusMutation.mutate(status);
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  if (!order) return <div className="p-8 text-gray-500">Order not found.</div>;

  return (
    <div className="p-8 flex flex-col gap-6 max-w-3xl">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-400 hover:underline self-start"
      >
        ← Back
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Order #{order.order_id}
          </h1>
          <p className="text-sm text-gray-500">
            {formatDate(order.created_at)} · User #{order.user_id}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Status update */}
      <div className="flex items-center gap-3 rounded-xl border p-4">
        <span className="text-sm font-medium">Update Status:</span>
        <select
          value={order.status}
          disabled={updating}
          onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {updating && <Spinner size="sm" />}
      </div>

      {/* Order items */}
      <section className="rounded-xl border p-5">
        <h2 className="mb-4 font-semibold">Items</h2>
        <div className="flex flex-col divide-y text-sm">
          {order.items.map((item) => (
            <div
              key={`${item.product_id}-${item.variant_id}`}
              className="flex justify-between py-2"
            >
              <span>
                Product #{item.product_id} / Variant #{item.variant_id} ×{" "}
                {item.quantity}
              </span>
              <span className="font-medium">{formatPrice(item.subtotal)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-3 font-semibold">
            <span>Total</span>
            <span>{formatPrice(order.total_amount)}</span>
          </div>
        </div>
      </section>

      {/* Shipping */}
      <section className="rounded-xl border p-5">
        <h2 className="mb-2 font-semibold">Shipping</h2>
        <p className="text-sm text-gray-600">{order.shipping_address}</p>
        {order.shipping?.tracking_code && (
          <p className="mt-1 text-xs text-gray-400">
            Tracking: {order.shipping.tracking_code}
          </p>
        )}
      </section>
    </div>
  );
}
