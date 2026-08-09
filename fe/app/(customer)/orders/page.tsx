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

    if (!user) {
      router.replace("/");
    }
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

  if (!hasHydrated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Breadcrumb */}
        <Link
          href="/"
          className="group mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <svg
            className="h-4 w-4 transition-transform group-hover:-translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to shopping
        </Link>

        {/* Page Header */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Account Overview
              </p>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                My Orders
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                View your order history and track your purchases.
              </p>
            </div>

            {meta && (
              <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Total Orders
                  </p>

                  <p className="text-lg font-bold text-slate-900">
                    {meta.total}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-12 shadow-xl shadow-slate-200/40">
            <Spinner size="lg" />

            <p className="mt-4 text-sm font-medium text-slate-500">
              Retrieving your orders...
            </p>
          </div>
        ) : orders.length === 0 ? (
          /* Empty State */
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xl shadow-slate-200/40 sm:p-16">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600 ring-8 ring-indigo-50/50">
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

            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Order History
            </p>

            <h2 className="text-xl font-bold text-slate-900">No orders yet</h2>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              You haven&rsquo;t placed any orders yet. Start exploring our
              catalogue and find something you&rsquo;ll love.
            </p>

            <Link
              href="/products"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:from-indigo-500 hover:to-indigo-400 hover:shadow-indigo-500/35 active:translate-y-0"
            >
              Start Shopping
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14m-6-6l6 6-6 6"
                />
              </svg>
            </Link>
          </div>
        ) : (
          <>
            {/* Orders Section Header */}
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Order History
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  Your recent purchases
                </p>
              </div>

              <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600">
                {meta?.total ?? orders.length}{" "}
                {(meta?.total ?? orders.length) === 1 ? "order" : "orders"}
              </span>
            </div>

            {/* Orders List */}
            <div className="flex flex-col gap-5">
              {orders.map((order) => (
                <OrderCard key={order.order_id} order={order} />
              ))}
            </div>

            {/* Pagination */}
            {meta && (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-xl shadow-slate-200/40">
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                  <p className="text-xs text-slate-400">
                    Showing{" "}
                    <span className="font-semibold text-slate-600">
                      {orders.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-600">
                      {meta.total}
                    </span>{" "}
                    orders
                  </p>

                  <Pagination meta={meta} onPageChange={setPage} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
