"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminService } from "../../../services/staff/admin.service";
import { formatDate, formatPrice } from "../../../lib/utils";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import OrderStatusBadge from "../../../components/order/OrderStatusBadge";
import Input from "../../../components/ui/Input";
import type { Order, OrderStatus, PaginationMeta } from "../../../interfaces";

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

export default function StaffOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    adminService
      .getAllOrders({
        page,
        limit: 20,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(userIdFilter ? { user_id: Number(userIdFilter) } : {}),
      })
      .then((res) => {
        setOrders(res.data);
        setMeta(res.meta);
      })
      .catch(() => toast.error("Failed to load orders."))
      .finally(() => setLoading(false));
  }, [page, statusFilter, userIdFilter]);

  async function handleStatusChange(order_id: number, status: OrderStatus) {
    setUpdatingId(order_id);
    try {
      await adminService.updateOrderStatus(order_id, status);
      setOrders((prev) =>
        prev.map((o) => (o.order_id === order_id ? { ...o, status } : o)),
      );
      toast.success("Status updated.");
    } catch {
      toast.error("Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Orders</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderStatus | "");
              setPage(1);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            render: (r) => (
              <select
                value={r.status as string}
                disabled={updatingId === r.order_id}
                onChange={(e) => {
                  e.stopPropagation();
                  handleStatusChange(
                    r.order_id as number,
                    e.target.value as OrderStatus,
                  );
                }}
                onClick={(e) => e.stopPropagation()}
                className="rounded border border-gray-300 px-2 py-1 text-xs"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            ),
          },
        ]}
        rows={orders as unknown as Record<string, unknown>[]}
        rowKey={(r) => r.order_id as number}
        loading={loading}
        meta={meta ?? undefined}
        onPageChange={setPage}
        onRowClick={(r) => router.push(`/staff/orders/${r.order_id as number}`)}
      />
    </div>
  );
}
