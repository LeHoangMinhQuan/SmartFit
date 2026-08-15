"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import Combobox from "../../../components/ui/Combobox";
import Spinner from "../../../components/ui/Spinner";
import type { OrderStatus, User } from "../../../interfaces";

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

function isOrderStatus(v: string): v is OrderStatus {
  return (STATUS_OPTIONS as string[]).includes(v);
}

// useSearchParams() requires a Suspense boundary above it (Next.js
// static-rendering rule) — same reason payment/result/page.tsx and
// tryon/page.tsx already split into a thin page + inner PageContent.
// This page follows that same split rather than introducing a
// differently-shaped pattern for the one page in /staff that reads the
// URL.
export default function StaffOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      }
    >
      <StaffOrdersPageContent />
    </Suspense>
  );
}

function StaffOrdersPageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Filters are seeded from the URL on first render (not re-read on every
  // navigation — Next's searchParams are already stable per-render) so
  // links from elsewhere (the dashboard's "needs attention" cards, a
  // shared/bookmarked URL) land pre-filtered instead of always opening on
  // the unfiltered default. Each filter change below still updates local
  // state directly for responsiveness; see setFilter for how the URL stays
  // in sync afterward so the page remains bookmarkable/shareable as
  // filters change, not just on initial load.
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">(
    initialStatus && isOrderStatus(initialStatus) ? initialStatus : "",
  );
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [fromFilter, setFromFilter] = useState(searchParams.get("from") ?? "");
  const [toFilter, setToFilter] = useState(searchParams.get("to") ?? "");
  const [needsFulfillmentOnly, setNeedsFulfillmentOnly] = useState(
    searchParams.get("needs_fulfillment") === "true",
  );
  const [unclaimedOnly, setUnclaimedOnly] = useState(
    searchParams.get("unclaimed") === "true",
  );

  // Pushes the current filter state into the URL (replace, not push — a
  // filter tweak shouldn't pile up back-button history entries) so the
  // page stays a shareable/bookmarkable link as staff adjust it, the same
  // way it can already be landed on pre-filtered.
  function syncUrl(next: {
    status?: OrderStatus | "";
    from?: string;
    to?: string;
    needs_fulfillment?: boolean;
    unclaimed?: boolean;
  }) {
    const params = new URLSearchParams();
    const status = next.status ?? statusFilter;
    const from = next.from ?? fromFilter;
    const to = next.to ?? toFilter;
    const needsFulfillment = next.needs_fulfillment ?? needsFulfillmentOnly;
    const unclaimed = next.unclaimed ?? unclaimedOnly;
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (needsFulfillment) params.set("needs_fulfillment", "true");
    if (unclaimed) params.set("unclaimed", "true");
    const qs = params.toString();
    router.replace(qs ? `/staff/orders?${qs}` : "/staff/orders");
  }

  const { data: userResults = [], isFetching: searchingUsers } = useQuery({
    queryKey: ["staff-orders-user-search", userQuery],
    queryFn: () => adminService.searchUsers(userQuery, { limit: 10 }),
    enabled: userQuery.trim().length > 0,
  });

  const { data, isLoading: loading } = useQuery({
    queryKey: [
      "staff-orders",
      {
        page,
        statusFilter,
        userId: selectedUser?.user_id,
        fromFilter,
        toFilter,
        needsFulfillmentOnly,
        unclaimedOnly,
      },
    ],
    queryFn: () =>
      adminService.getAllOrders({
        page,
        limit: 20,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(selectedUser ? { user_id: selectedUser.user_id } : {}),
        ...(fromFilter ? { from: fromFilter } : {}),
        ...(toFilter ? { to: toFilter } : {}),
        ...(needsFulfillmentOnly ? { needs_fulfillment: true } : {}),
        ...(unclaimedOnly ? { unclaimed: true } : {}),
      }),
    placeholderData: keepPreviousData,
  });
  const orders = data?.data ?? [];
  const meta = data?.meta ?? null;

  const updateStatusMutation = useMutation({
    mutationFn: (vars: { order_id: number; status: OrderStatus }) =>
      adminService.updateOrderStatus(vars.order_id, vars.status),
    onSuccess: () => {
      // Invalidate rather than hand-patch status locally — a successful
      // call may have just claimed the order (see adminUpdateStatus in
      // order.service.ts), which would also change handler_name/staff_id/
      // is_unclaimed on this row, not just status.
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
              const value = e.target.value as OrderStatus | "";
              setStatusFilter(value);
              setPage(1);
              syncUrl({ status: value });
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
          label="From"
          type="date"
          value={fromFilter}
          onChange={(e) => {
            setFromFilter(e.target.value);
            setPage(1);
            syncUrl({ from: e.target.value });
          }}
          className="w-40"
        />
        <Input
          label="To"
          type="date"
          value={toFilter}
          onChange={(e) => {
            setToFilter(e.target.value);
            setPage(1);
            syncUrl({ to: e.target.value });
          }}
          className="w-40"
        />
        <div className="w-56">
          <Combobox<User>
            label="User"
            items={userResults}
            value={selectedUser}
            onChange={(u) => {
              setSelectedUser(u);
              setPage(1);
            }}
            getKey={(u) => u.user_id}
            getLabel={(u) => u.username}
            getSublabel={(u) => u.email}
            query={userQuery}
            onQueryChange={setUserQuery}
            loading={searchingUsers}
            placeholder="Search by username…"
            emptyMessage={
              userQuery.trim() ? "No users found." : "Type to search…"
            }
          />
        </div>
        <label
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          title="Confirmed orders (paid / cod_confirmed) with no GHN shipment created yet"
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={needsFulfillmentOnly}
            onChange={(e) => {
              setNeedsFulfillmentOnly(e.target.checked);
              setPage(1);
              syncUrl({ needs_fulfillment: e.target.checked });
            }}
          />
          Missing GHN Shipment
        </label>
        <label
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          title="Orders no staff member has claimed yet"
        >
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={unclaimedOnly}
            onChange={(e) => {
              setUnclaimedOnly(e.target.checked);
              setPage(1);
              syncUrl({ unclaimed: e.target.checked });
            }}
          />
          Unclaimed
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <DataTable
          columns={[
            { key: "order_id", header: "Order", className: "w-20" },
            {
              key: "user_id",
              header: "User",
              className: "w-32",
              render: (r) => (
                <span title={`User #${r.user_id as number}`}>
                  {(r.username as string | null | undefined) ??
                    `#${r.user_id as number}`}
                </span>
              ),
            },
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
              key: "handler_name",
              header: "Handled By",
              render: (r) =>
                r.is_unclaimed ? (
                  <span className="text-slate-400 italic">Unassigned</span>
                ) : (
                  <span title="Locked to this staff member until an admin overrides it">
                    {(r.handler_name as string | null) ??
                      `Staff #${r.staff_id as number}`}
                  </span>
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
