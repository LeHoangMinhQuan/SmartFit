"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { adminService } from "../../../../services/staff/admin.service";
import { formatDate, formatPrice } from "../../../../lib/utils";
import { toast } from "../../../../components/ui/Toast";
import Spinner from "../../../../components/ui/Spinner";
import OrderStatusBadge from "../../../../components/order/OrderStatusBadge";
import { useStaffAuthStore } from "../../../../store/useStaffAuthStore";
import type { GhnRequiredNote, OrderStatus } from "../../../../interfaces";

// GHN's 3 options for whether the recipient can inspect the goods before
// accepting them — staff/admin choose this per order (previously
// hardcoded, and hardcoded to an invalid value — see ghn.service.ts's
// BUG FIX comment on required_note). Labels are the plain-language
// meaning, not the GHN codes, since staff shouldn't need to memorize
// Vietnamese shipping jargon to use the dropdown.
const REQUIRED_NOTE_OPTIONS: { value: GhnRequiredNote; label: string }[] = [
  { value: "KHONGCHOXEMHANG", label: "No inspection allowed" },
  { value: "CHOXEMHANGKHONGTHU", label: "Can view, not try on" },
  { value: "CHOTHUHANG", label: "Can view and try on" },
];
const DEFAULT_REQUIRED_NOTE: GhnRequiredNote = "CHOXEMHANGKHONGTHU";

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
  const currentStaffId = useStaffAuthStore((s) => s.staffId);
  const isAdmin = useStaffAuthStore((s) => s.isAdmin)();

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

  // Only admins can assign, and only unclaimed orders are eligible (see
  // adminAssignStaff's doc comment in order.service.ts — an already-claimed
  // order must go through the status-change ownership flow instead).
  const canAssign = isAdmin && !!order?.is_unclaimed;

  const staffListQuery = useQuery({
    queryKey: ["staff-list-for-assign"],
    queryFn: () => adminService.getStaffList(),
    enabled: canAssign,
  });
  const staffList = staffListQuery.data?.data ?? [];

  const assignStaffMutation = useMutation({
    mutationFn: (staff_id: number) =>
      adminService.assignOrderStaff(order!.order_id, staff_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["staff-orders"] });
      toast.success("Order assigned.");
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? "Failed to assign order.")
        : "Failed to assign order.";
      toast.error(message);
    },
  });
  const assigning = assignStaffMutation.isPending;

  function handleAssignStaff(staffIdRaw: string) {
    const staff_id = Number(staffIdRaw);
    if (!staff_id) return;
    assignStaffMutation.mutate(staff_id);
  }

  const updateStatusMutation = useMutation({
    mutationFn: (status: OrderStatus) =>
      adminService.updateOrderStatus(order!.order_id, status),
    onSuccess: (_data, status) => {
      // A successful call may have just claimed this order (first
      // staff/admin to advance it past SYSTEM_STAFF_ID — see
      // adminUpdateStatus in order.service.ts), so refetch rather than
      // just patch status locally; that's the only way to pick up the new
      // handler_name/staff_id/is_unclaimed without duplicating the
      // backend's claim logic here.
      queryClient.invalidateQueries({ queryKey: ["staff-order", orderId] });
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

  const [retryRequiredNote, setRetryRequiredNote] = useState<GhnRequiredNote>(
    DEFAULT_REQUIRED_NOTE,
  );

  const retryShipmentMutation = useMutation({
    mutationFn: () =>
      adminService.retryShipment(order!.order_id, retryRequiredNote),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["staff-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["staff-orders"] });
      toast.success(`Shipment created — tracking ${result.tracking_code}.`);
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? "Failed to create shipment.")
        : "Failed to create shipment.";
      toast.error(message);
    },
  });

  function handleRetryShipment() {
    if (!order) return;
    retryShipmentMutation.mutate();
  }

  const [noteEditValue, setNoteEditValue] = useState<GhnRequiredNote | null>(
    null,
  );

  const updateNoteMutation = useMutation({
    mutationFn: (required_note: GhnRequiredNote) =>
      adminService.updateShipmentRequiredNote(order!.order_id, required_note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-order", orderId] });
      toast.success("Shipment inspection policy updated.");
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ??
          "Failed to update shipment — it may already be picked up.")
        : "Failed to update shipment.";
      toast.error(message);
    },
  });

  function handleUpdateNote() {
    if (!order || !noteEditValue) return;
    updateNoteMutation.mutate(noteEditValue);
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
  // Confirmed but never got a GHN shipment — see order.model.ts's
  // STUCK_SHIPMENT_STATUSES / OrderService.retryShipment doc comment.
  const needsShipmentRetry =
    !order.shipping_order_id &&
    (order.status === "paid" || order.status === "cod_confirmed");
  // STAFF-ROLE FEATURE: pre-emptive lock check, so a staff account sees
  // *why* the dropdown is disabled instead of only finding out after
  // submitting and getting the backend's 403 (adminUpdateStatus in
  // order.service.ts is still the real enforcement — this is just UX).
  // Admins are never locked out by another staff's claim.
  const lockedByOther =
    !order.is_unclaimed && !isAdmin && order.staff_id !== currentStaffId;

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
          <div className="mt-1 flex items-center gap-2 text-sm">
            {order.is_unclaimed ? (
              <span className="text-slate-400 italic">
                Unassigned — not yet claimed
              </span>
            ) : (
              <span className="text-slate-500">
                Handled by{" "}
                <span className="font-medium text-slate-700">
                  {order.handler_name ?? `Staff #${order.staff_id}`}
                </span>
                {order.staff_id === currentStaffId && " (you)"}
              </span>
            )}
            {canAssign && (
              <span className="flex items-center gap-1.5">
                <select
                  defaultValue=""
                  disabled={assigning || staffListQuery.isLoading}
                  onChange={(e) => handleAssignStaff(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>
                    {staffListQuery.isLoading
                      ? "Loading staff…"
                      : "Assign staff…"}
                  </option>
                  {staffList.map((s) => (
                    <option key={s.staff_id} value={s.staff_id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {assigning && <Spinner size="sm" />}
              </span>
            )}
          </div>
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
          disabled={updating || isTerminal || lockedByOther}
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
        {lockedByOther && !isTerminal && !updating && (
          <span className="text-xs text-amber-600">
            Locked to {order.handler_name ?? `Staff #${order.staff_id}`} — only
            they or an admin can update this order.
          </span>
        )}
      </div>

      {needsShipmentRetry && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex-1 text-sm text-red-800">
            <p className="font-medium">Shipment was never created</p>
            <p className="mt-0.5 text-red-700">
              This order was confirmed, but creating its GHN shipment failed (or
              was never attempted), so it has no tracking code and won&rsquo;t
              show up as needing fulfillment elsewhere. Choose an inspection
              policy and retry once the underlying issue (GHN outage, bad
              address, etc.) is resolved.
            </p>
          </div>
          <select
            value={retryRequiredNote}
            disabled={retryShipmentMutation.isPending}
            onChange={(e) =>
              setRetryRequiredNote(e.target.value as GhnRequiredNote)
            }
            className="rounded-lg border border-red-300 bg-white px-2 py-2 text-xs text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {REQUIRED_NOTE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleRetryShipment}
            disabled={retryShipmentMutation.isPending}
            className="whitespace-nowrap rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {retryShipmentMutation.isPending
              ? "Creating shipment..."
              : "Retry Shipment"}
          </button>
        </div>
      )}

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
              className="flex items-center gap-3 py-3 text-slate-700"
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.product_name}
                  className="h-14 w-14 shrink-0 rounded-lg border border-slate-100 bg-slate-50 object-cover"
                />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-100" />
              )}
              <div className="flex flex-1 items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">
                    {item.product_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.variant_name}
                    <span className="mx-1.5 text-slate-300">•</span>
                    Qty: {item.quantity}
                  </p>
                </div>
                <span className="font-medium text-slate-900">
                  {formatPrice(item.subtotal)}
                </span>
              </div>
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
        {order.shipping && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-sm font-medium text-slate-700">
              Inspection policy:
            </span>
            <select
              value={
                noteEditValue ??
                order.shipping.required_note ??
                DEFAULT_REQUIRED_NOTE
              }
              disabled={updateNoteMutation.isPending}
              onChange={(e) =>
                setNoteEditValue(e.target.value as GhnRequiredNote)
              }
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {REQUIRED_NOTE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {noteEditValue &&
              noteEditValue !== order.shipping.required_note && (
                <button
                  onClick={handleUpdateNote}
                  disabled={updateNoteMutation.isPending}
                  className="whitespace-nowrap rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-900 disabled:opacity-50"
                >
                  {updateNoteMutation.isPending ? "Saving..." : "Save"}
                </button>
              )}
            <span
              className="text-xs text-slate-400"
              title="GHN only allows changing this while the shipment hasn't been picked up yet"
            >
              (only before pickup)
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
