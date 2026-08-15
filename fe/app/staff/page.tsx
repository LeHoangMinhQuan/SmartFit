"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { adminService } from "../../services/staff/admin.service";
import { formatPrice } from "../../lib/utils";
import { toast } from "../../components/ui/Toast";
import StatsCard from "../../components/staff/StatsCard";
import RevenueChart from "../../components/staff/RevenueChart";
import Spinner from "../../components/ui/Spinner";

type PresetKey = "today" | "7d" | "30d" | "90d" | "all";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "90d", label: "90 Days" },
  { key: "all", label: "All Time" },
];

function presetToRange(preset: PresetKey): { from?: string; to?: string } {
  if (preset === "all") return {};
  const to = new Date().toISOString().slice(0, 10);
  const days =
    preset === "today" ? 0 : preset === "7d" ? 6 : preset === "30d" ? 29 : 89;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

// A clickable wrapper around StatsCard — turns a static count into a
// direct link into the pre-filtered orders list, so "2 Cancelled" is
// something staff can act on instead of just a number to notice and then
// go build the same filter manually on the orders page.
function LinkedStatsCard({
  href,
  ...cardProps
}: { href: string } & Parameters<typeof StatsCard>[0]) {
  return (
    <Link
      href={href}
      className="block focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded-xl"
    >
      <StatsCard {...cardProps} />
    </Link>
  );
}

// useSearchParams() requires a Suspense boundary — same reason as
// app/staff/orders/page.tsx's split (this page reads/writes ?preset=&
// from=&to= so a chosen range survives a refresh and stays shareable).
export default function StaffDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      }
    >
      <StaffDashboardContent />
    </Suspense>
  );
}

function StaffDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlPreset = searchParams.get("preset") as PresetKey | null;
  const urlFrom = searchParams.get("from");
  const urlTo = searchParams.get("to");
  const [preset, setPreset] = useState<PresetKey>(
    urlPreset && PRESETS.some((p) => p.key === urlPreset) ? urlPreset : "30d",
  );
  const [customFrom, setCustomFrom] = useState(urlFrom ?? "");
  const [customTo, setCustomTo] = useState(urlTo ?? "");
  const [useCustomRange, setUseCustomRange] = useState(
    Boolean(urlFrom || urlTo) && !urlPreset,
  );

  const range = useCustomRange
    ? { from: customFrom || undefined, to: customTo || undefined }
    : presetToRange(preset);

  function selectPreset(key: PresetKey) {
    setPreset(key);
    setUseCustomRange(false);
    const params = new URLSearchParams();
    if (key !== "30d") params.set("preset", key);
    const qs = params.toString();
    router.replace(qs ? `/staff?${qs}` : "/staff");
  }

  function applyCustomRange() {
    setUseCustomRange(true);
    const params = new URLSearchParams();
    if (customFrom) params.set("from", customFrom);
    if (customTo) params.set("to", customTo);
    router.replace(`/staff?${params.toString()}`);
  }

  const {
    data: stats,
    isLoading: loading,
    isError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["staff-dashboard", range],
    queryFn: () => adminService.getDashboard(range),
    // "Monitoring page, not just show-and-left" — the dashboard now keeps
    // itself current without a manual reload. React Query's default
    // refetchIntervalInBackground: false already skips this while the
    // tab isn't focused, so it's not silently hammering the API from a
    // forgotten background tab. 30s is a middle ground: fast enough for
    // "Needs Attention" counts (unclaimed orders, refund requests) to
    // feel live, not so fast it noticeably taxes the dashboard query
    // during a busy sales period with many concurrent staff viewing it.
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (isError) toast.error("Failed to load dashboard.");
  }, [isError]);

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  if (!stats)
    return <div className="p-8 text-slate-500">No data available.</div>;

  // Flatten the backend's array-of-rows shape into a lookup map so both the
  // top KPI cards and the per-status breakdown below can index by status.
  const ordersByStatus: Record<string, number> = Object.fromEntries(
    (stats.orders_by_status ?? []).map((row) => [
      row.status,
      Number(row.count),
    ]),
  );

  // Builds an /staff/orders link carrying the dashboard's current date
  // range along with a status/flag filter — the "click a card, land on
  // exactly those orders" behavior the cards below rely on.
  function ordersLink(extra: Record<string, string>): string {
    const params = new URLSearchParams(extra);
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    return `/staff/orders?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          {/* Visible proof the page is actually monitoring, not just a
             static report that happens to poll silently in the
             background — a staff member glancing at the screen should
             be able to tell at a glance this number is live. */}
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {dataUpdatedAt
              ? `Live · updated ${new Date(dataUpdatedAt).toLocaleTimeString()}`
              : "Live"}
          </span>
        </div>

        {/* Date range controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-2xl p-1.5 border border-slate-200 bg-white shadow-sm">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => selectPreset(p.key)}
                className={`px-3 py-1.5 text-sm font-medium transition-all rounded-xl cursor-pointer ${
                  !useCustomRange && preset === p.key
                    ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          />
          <button
            onClick={applyCustomRange}
            disabled={!customFrom && !customTo}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Needs Attention — the "monitoring" half of the dashboard. Not
         scoped to the date range above (see backend comment on
         needs_attention) — these are current operational backlog, not a
         historical report. */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
        <h2 className="mb-4 font-semibold text-amber-900">Needs Attention</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <LinkedStatsCard
            href="/staff/orders?unclaimed=true"
            label="Unclaimed Orders"
            value={stats.needs_attention.unclaimed_orders}
            variant={
              stats.needs_attention.unclaimed_orders > 0 ? "warning" : "default"
            }
            hint="No staff member assigned yet"
          />
          <LinkedStatsCard
            href="/staff/orders?needs_fulfillment=true"
            label="Missing GHN Shipment"
            value={stats.needs_attention.missing_shipment}
            variant={
              stats.needs_attention.missing_shipment > 0 ? "error" : "default"
            }
            hint="Confirmed but no shipment created"
          />
          <LinkedStatsCard
            href="/staff/orders?status=refund_requested"
            label="Refund Requested"
            value={stats.needs_attention.refund_requested}
            variant={
              stats.needs_attention.refund_requested > 0 ? "warning" : "default"
            }
            hint="Awaiting staff review"
          />
        </div>
      </section>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          label="Total Revenue"
          value={formatPrice(stats.total_revenue)}
          variant="revenue"
          hint="Paid + fulfilled orders in range"
        />
        <LinkedStatsCard
          href="/staff/users"
          label="New Users"
          value={stats.new_users_last_30d}
          variant="users"
          hint="Last 30 days (fixed window)"
        />
        <LinkedStatsCard
          href={ordersLink({ status: "delivered" })}
          label="Delivered Orders"
          value={ordersByStatus["delivered"] ?? 0}
          variant="delivered"
        />
        <LinkedStatsCard
          href={ordersLink({ status: "pending_payment" })}
          label="Pending Payment"
          value={ordersByStatus["pending_payment"] ?? 0}
          variant="pending"
        />
      </div>

      {/* Revenue trend */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Revenue Trend</h2>
        <RevenueChart data={stats.revenue_series ?? []} />
      </section>

      {/* Orders by status — every card here is a click-through into the
         pre-filtered orders list (e.g. "2 Cancelled" -> those exact 2
         orders), not just a static count. */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Orders by Status</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(ordersByStatus).map(([status, count]) => (
            <LinkedStatsCard
              key={status}
              href={ordersLink({ status })}
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
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-4 py-3 text-slate-800">Product</th>
                <th className="px-4 py-3 text-right text-slate-800">
                  Units Sold
                </th>
                <th className="px-4 py-3 text-right text-slate-800">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(stats?.top_products ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    No sales data yet.
                  </td>
                </tr>
              ) : (
                (stats?.top_products ?? []).map((p) => (
                  <tr
                    key={p.product_id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-slate-800">
                      <Link
                        href={`/staff/products/${p.product_id}`}
                        className="hover:text-indigo-600 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {p.sold}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatPrice(p.revenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
