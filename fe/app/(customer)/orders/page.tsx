"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import { orderService } from "../../../services/order.service";
import { useAuthStore } from "../../../store/useAuthStore";
import OrderCard from "../../../components/order/OrderCard";
import Pagination from "../../../components/ui/Pagination";
import Spinner from "../../../components/ui/Spinner";

export default function OrdersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [page, setPage] = useState(1);

  // Guests can't view order history
  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) router.replace("/");
  }, [hasHydrated, user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", user?.user_id, page],
    queryFn: () => orderService.getOrders({ page, limit: 10 }),
    enabled: hasHydrated && !!user,
    placeholderData: keepPreviousData,
  });
  const loading = !hasHydrated || isLoading;

  const orders = data?.data ?? [];
  const meta = data?.meta ?? null;

  if (!hasHydrated || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Account Overview
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              My Orders
            </h1>
          </div>
          {orders.length > 0 && (
            <p className="text-sm font-medium text-slate-500">
              Showing total{" "}
              <span className="font-semibold text-slate-900">
                {meta?.total ?? orders.length}
              </span>{" "}
              order(s)
            </p>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-20 shadow-xl shadow-slate-200/40">
            <Spinner size="lg" />
            <p className="mt-4 text-sm font-medium text-slate-500">
              Loading your orders...
            </p>
          </div>
        ) : orders.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center text-center rounded-3xl border border-slate-200 bg-white p-12 sm:p-16 shadow-xl shadow-slate-200/40">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 ring-8 ring-indigo-50/50">
              <svg
                className="h-10 w-10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">No orders yet</h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              You haven&rsquo;t placed any orders yet. Start exploring our
              catalogue and find items tailored for you.
            </p>
            <Link
              href="/products"
              className="mt-8 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:from-indigo-500 hover:to-indigo-400 hover:shadow-indigo-500/35 active:translate-y-0"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          /* Orders List */
          <div className="flex flex-col gap-5">
            <div className="space-y-4">
              {orders.map((o) => (
                <OrderCard key={o.order_id} order={o} />
              ))}
            </div>

            {meta && (
              <div className="mt-6 flex justify-center border-t border-slate-200 pt-6">
                <Pagination meta={meta} onPageChange={setPage} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
