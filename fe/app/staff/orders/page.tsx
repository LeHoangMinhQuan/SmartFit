"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { adminService } from "../../../services/staff/admin.service";
import { formatDate, formatPrice } from "../../../lib/utils";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import OrderStatusBadge from "../../../components/order/OrderStatusBadge";
import Input from "../../../components/ui/Input";
import type { Order, OrderStatus } from "../../../interfaces";

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
// (VALID_TRANSITIONS[status] === [] — see order.service.ts). Kept in
// sync with the same check in orders/[order_id]/page.tsx.
const TERMINAL_STATUSES: OrderStatus[] = ["cancelled", "refunded"];

export default function StaffOrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [userIdFilter, setUserIdFilter] = useState("");

  const { data, isLoading: loading } = useQuery({
    queryKey: ["staff-orders", { page, statusFilter, userIdFilter }],
    queryFn: () =>
      adminService.getAllOrders({
        page,
        limit: 20,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(userIdFilter ? { user_id: Number(userIdFilter) } : {}),
      }),
    placeholderData: keepPreviousData,
  });
  const orders = data?.data ?? [];
  const meta = data?.meta ?? null;

  const updateStatusMutation = useMutation({
    mutationFn: (vars: { order_id: number; status: OrderStatus }) =>
      adminService.updateOrderStatus(vars.order_id, vars.status),
    onSuccess: (_data, vars) => {
      queryClient.setQueriesData<{ data: Order[]; meta: unknown } | undefined>(
        { queryKey: ["staff-orders"] },
        (old) =>
          old && {
            ...old,
            data: old.data.map((o) =>
              o.order_id === vars.order_id ? { ...o, status: vars.status } : o,
            ),
          },
      );
      toast.success("Status updated.");
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? "Failed to update status.")
        : "Failed to update status.";
      toast.error(message);
    },
  });
  const updatingId = updateStatusMutation.isPending
    ? updateStatusMutation.variables?.order_id
    : null;

  async function handleStatusChange(order_id: number, status: OrderStatus) {
    updateStatusMutation.mutate({ order_id, status });
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Orders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review orders and update fulfillment status.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 uppercase">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | "");
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="User ID"
          type="number"
          value={userIdFilter}
          onChange={(e) => {
            setUserIdFilter(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by user…"
          className="w-36"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <DataTable
          columns={[
            { key: "order_id", header: "Order", className: "w-20" },
            { key: "user_id", header: "User", className: "w-20" },
            {
              key: "created_at",
              header: "Date",
              render: (r) => formatDate(r.created_at as string),
            },
            {
              key: "total_amount",
              header: "Total",
              render: (r) => formatPrice(r.total_amount as number),
            },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <OrderStatusBadge status={r.status as OrderStatus} />
              ),
            },
            {
              key: "update_status",
              header: "Update Status",
              render: (r) => {
                const isTerminal = TERMINAL_STATUSES.includes(
                  r.status as OrderStatus,
                );
                return (
                  <select
                    value={r.status as string}
                    disabled={updatingId === r.order_id || isTerminal}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleStatusChange(
                        r.order_id as number,
                        e.target.value as OrderStatus,
                      );
                    }}
                    onClick={(e) => e.stopPropagation()}
                    title={isTerminal ? "This status is final." : undefined}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                );
              },
            },
          ]}
          rows={orders as unknown as Record<string, unknown>[]}
          rowKey={(r) => r.order_id as number}
          loading={loading}
          meta={meta ?? undefined}
          onPageChange={setPage}
          onRowClick={(r) =>
            router.push(`/staff/orders/${r.order_id as number}`)
          }
        />
      </div>
    </div>
  );
}
