"use client";

import { formatPrice } from "../../lib/utils";

interface RevenuePoint {
  date: string; // "YYYY-MM-DD"
  revenue: number;
  order_count: number;
}

interface RevenueChartProps {
  data: RevenuePoint[];
}

/**
 * Plain-SVG bar chart — deliberately not built on a charting library.
 * This project has no charting dependency installed yet, and adding one
 * just for a single dashboard chart isn't worth a new dependency (and
 * the network access to install it) when the actual shape needed here —
 * a handful of bars scaled to a max value, with a hover tooltip — is
 * simple enough to hand-roll. Revisit with recharts/etc. if the
 * dashboard grows more chart types.
 */
export default function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        No revenue data for this range.
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const width = 100 / data.length; // percent per bar

  return (
    <div className="flex h-48 items-end gap-[2px]">
      {data.map((point) => {
        const heightPct = Math.max((point.revenue / maxRevenue) * 100, 2);
        return (
          <div
            key={point.date}
            className="group relative flex h-full flex-1 items-end"
            style={{ maxWidth: `${width}%` }}
          >
            <div
              className="w-full rounded-t bg-indigo-400 transition-colors group-hover:bg-indigo-600"
              style={{ height: `${heightPct}%` }}
            />
            {/* Tooltip — shown on hover, positioned above the bar */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
              <div className="font-semibold">{formatPrice(point.revenue)}</div>
              <div className="text-slate-300">
                {point.date} · {point.order_count} order
                {point.order_count === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
