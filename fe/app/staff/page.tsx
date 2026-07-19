"use client";

import { useEffect, useState } from "react";
import { adminService } from "../../services/staff/admin.service";
import { formatPrice } from "../../lib/utils";
import { toast } from "../../components/ui/Toast";
import StatsCard from "../../components/staff/StatsCard";
import Spinner from "../../components/ui/Spinner";
import type { OrderStatus } from "../../interfaces";

interface DashboardStats {
  total_revenue: number;
  orders_by_status: Record<OrderStatus, number>;
  top_products: Array<{ product_id: number; name: string; sold: number }>;
  new_users_last_30d: number;
}

export default function StaffDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService
      .getDashboard()
      .then(setStats)
      .catch(() => toast.error("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  if (!stats)
    return <div className="p-8 text-gray-500">No data available.</div>;

  return (
    <div className="p-8 flex flex-col gap-8 min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          label="Total Revenue"
          value={formatPrice(stats.total_revenue)}
          variant="revenue"
        />
        <StatsCard
          label="New Users"
          value={stats.new_users_last_30d}
          variant="users"
        />
        <StatsCard
          label="Delivered Orders"
          value={stats.orders_by_status?.["delivered"] ?? 0}
          variant="delivered"
        />
        <StatsCard
          label="Pending Payment"
          value={stats.orders_by_status?.["pending_payment"] ?? 0}
          variant="pending"
        />
      </div>

      {/* Orders by status */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Orders by Status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(
            Object.entries(stats?.orders_by_status ?? {}) as [
              OrderStatus,
              number,
            ][]
          ).map(([status, count]) => (
            <StatsCard
              key={status}
              label={status.replace(/_/g, " ")}
              value={count}
            />
          ))}
        </div>
      </section>

      {/* Top products */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Top Products</h2>
        <div className="rounded-xl border bg-white shadow-sm border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Units Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(stats?.top_products ?? []).map((p) => (
                <tr key={p.product_id}>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3 text-right font-medium">{p.sold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
