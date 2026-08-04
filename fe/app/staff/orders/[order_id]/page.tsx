"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { adminService } from "../../../../services/staff/admin.service";
import { formatDate, formatPrice } from "../../../../lib/utils";
import { toast } from "../../../../components/ui/Toast";
import Spinner from "../../../../components/ui/Spinner";
import OrderStatusBadge from "../../../../components/order/OrderStatusBadge";
import type { OrderStatus } from "../../../../interfaces";

// Every status the schema allows, for correctly displaying whichever one
// an order is currently in (the <select>'s value must match one of its
// options or React can't show a selection). Which of these are actually
// selectable as a NEW target from the order's current status is enforced
// by the backend's VALID_TRANSITIONS (order.service.ts) — invalid picks
// are rejected with a specific error, surfaced via handleStatusChange's
// error handling below. "refunded" in particular can only actually be
// reached through the dedicated Process Refund action further down,
// which calls VNPay's refund API first; picking it directly here from a
// non-refunded order will always be rejected by the backend.
const STATUS_OPTIONS: OrderStatus[] = [
  "pending_payment",
  "cod_confirmed",
  "paid",
  "preparing",
  "shipping",
  "delivered",
  "cancelled",
  "payment_failed",
  "refund_requested",
  "refunded",
];

// Terminal states the backend has no outgoing transitions for
// (VALID_TRANSITIONS[status] === [] for both) — the dropdown is
// informational only once an order is here, so disable it rather than
// letting staff pick something that will just 400.
const TERMINAL_STATUSES: OrderStatus[] = ["cancelled", "refunded"];

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
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? "Failed to update status.")
        : "Failed to update status.";
      toast.error(message);
    },
  });
  const updating = updateStatusMutation.isPending;

  async function handleStatusChange(status: OrderStatus) {
    if (!order) return;
    updateStatusMutation.mutate(status);
  }

  const refundMutation = useMutation({
    mutationFn: () => adminService.processRefund(order!.order_id),
    onSuccess: (result) => {
      if (result.status === "success") {
        queryClient.setQueryData(
          ["staff-order", orderId],
          (old: typeof order) =>
            old ? { ...old, status: "refunded" as OrderStatus } : old,
        );
        queryClient.invalidateQueries({ queryKey: ["staff-orders"] });
        toast.success("Refund confirmed by VNPay.");
      } else {
        // Order stays 'refund_requested' — VNPay declined, safe to retry.
        // Refetch so latest_refund reflects this attempt (for the "last
        // attempt failed" note above), not just the toast.
        queryClient.invalidateQueries({ queryKey: ["staff-order", orderId] });
        toast.error(
          result.message || "VNPay declined the refund. You can retry.",
        );
      }
    },
    onError: () =>
      toast.error("Refund request failed — order left as-is for retry."),
  });

  async function handleProcessRefund() {
    if (!order) return;
    if (
      !confirm(
        `Refund ${formatPrice(order.total_amount)} to the customer via VNPay? This actually moves money — double check this is the right order.`,
      )
    )
      return;
    refundMutation.mutate();
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  if (!order) return <div className="p-8 text-slate-500">Order not found.</div>;

  const isTerminal = TERMINAL_STATUSES.includes(order.status);

  return (
    <div className="flex flex-col gap-6 p-8 max-w-3xl">
      <button
        onClick={() => router.back()}
        className="self-start text-sm text-slate-500 hover:cursor-pointer hover:text-slate-800 hover:underline"
      >
        ← Back
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Order #{order.order_id}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDate(order.created_at)} · User #{order.user_id}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Status update */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="text-sm font-medium text-slate-700">
          Update Status:
        </span>
        <select
          value={order.status}
          disabled={updating || isTerminal}
          onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {updating && <Spinner size="sm" />}
        {isTerminal && !updating && (
          <span className="text-xs text-slate-400">
            {order.status} is a final status — no further changes possible.
          </span>
        )}
      </div>

      {order.status === "refund_requested" && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex-1 text-sm text-amber-800">
            <p className="font-medium">Refund pending review</p>
            <p className="mt-0.5 text-amber-700">
              This order was already paid via VNPay and is waiting on a refund.
              Processing it calls VNPay&rsquo;s refund API for{" "}
              {formatPrice(order.total_amount)} — this actually moves money.
            </p>
            {order.latest_refund?.status === "failed" && (
              <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-900">
                Last attempt ({formatDate(order.latest_refund.created_at)})
                failed
                {order.latest_refund.vnpay_response_code
                  ? ` — VNPay code ${order.latest_refund.vnpay_response_code}`
                  : ""}
                . Safe to retry.
              </p>
            )}
          </div>
          <button
            onClick={handleProcessRefund}
            disabled={refundMutation.isPending}
            className="whitespace-nowrap rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {refundMutation.isPending ? "Processing..." : "Process Refund"}
          </button>
        </div>
      )}

      {/* Order items */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-900">Items</h2>
        <div className="flex flex-col divide-y divide-slate-100 text-sm">
          {order.items.map((item) => (
            <div
              key={`${item.product_id}-${item.variant_id}`}
              className="flex justify-between py-2 text-slate-700"
            >
              <span>
                Product #{item.product_id} / Variant #{item.variant_id} ×{" "}
                {item.quantity}
              </span>
              <span className="font-medium text-slate-900">
                {formatPrice(item.subtotal)}
              </span>
            </div>
          ))}
          <div className="flex justify-between pt-3 font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatPrice(order.total_amount)}</span>
          </div>
        </div>
      </section>

      {/* Shipping */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 font-semibold text-slate-900">Shipping</h2>
        <p className="text-sm text-slate-600">{order.shipping_address}</p>
        {order.shipping?.tracking_code && (
          <p className="mt-1 text-xs text-slate-400">
            Tracking: {order.shipping.tracking_code}
          </p>
        )}
      </section>
    </div>
  );
}
