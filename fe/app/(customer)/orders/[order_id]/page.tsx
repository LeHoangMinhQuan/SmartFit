"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orderService } from "../../../../services/order.service";
import { paymentService } from "../../../../services/payment.service";
import { productService } from "../../../../services/product.service";
import { shippingService } from "../../../../services/shipping.service";
import { useAuthStore } from "../../../../store/useAuthStore";
import { formatDate, formatDateTime, formatPrice } from "../../../../lib/utils";
import { toast } from "../../../../components/ui/Toast";
import Spinner from "../../../../components/ui/Spinner";
import OrderStatusBadge from "../../../../components/order/OrderStatusBadge";
import type { Product } from "../../../../interfaces";

export default function OrderDetailPage() {
  const params = useParams<{ order_id: string }>();
  const orderId = Number(params.order_id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) router.replace("/");
  }, [hasHydrated, user, router]);

  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderService.getOrder(orderId),
    enabled: hasHydrated && !!user,
  });
  const order = orderQuery.data ?? null;
  const loading = !hasHydrated || orderQuery.isLoading;

  useEffect(() => {
    if (orderQuery.isError) toast.error("Failed to load order.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderQuery.isError]);

  // order_item has no name/image snapshot — enrich from product_id lookups
  const productMapQuery = useQuery({
    queryKey: [
      "order-products",
      orderId,
      order?.items.map((i) => i.product_id),
    ],
    queryFn: async () => {
      const distinctIds = Array.from(
        new Set(order!.items.map((i) => i.product_id)),
      );
      const products = await Promise.all(
        distinctIds.map((id) =>
          productService.getProduct(id).catch(() => null),
        ),
      );
      const map: Record<number, Product> = {};
      products.forEach((p) => {
        if (p) map[p.product_id] = p;
      });
      return map;
    },
    enabled: !!order,
  });
  const productMap = productMapQuery.data ?? {};

  const trackingQuery = useQuery({
    queryKey: ["order-tracking", order?.shipping?.tracking_code],
    queryFn: () => shippingService.trackOrder(order!.shipping!.tracking_code!),
    enabled: !!order?.shipping?.tracking_code,
  });
  const trackingLogs = trackingQuery.data ?? [];

  const cancelMutation = useMutation({
    mutationFn: () => orderService.cancelOrder(order!.order_id),
    onSuccess: () => {
      queryClient.setQueryData(["order", orderId], (old: typeof order) =>
        old ? { ...old, status: "cancelled" } : old,
      );
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order cancelled.");
    },
    onError: () => toast.error("Failed to cancel order."),
  });
  const cancelling = cancelMutation.isPending;

  const retryPaymentMutation = useMutation({
    mutationFn: () => paymentService.createVNPayUrl(order!.order_id),
    onSuccess: ({ paymentUrl }) => {
      window.location.href = paymentUrl;
    },
    onError: () => toast.error("Failed to start payment. Please try again."),
  });
  const retrying = retryPaymentMutation.isPending;

  function handleRetryPayment() {
    if (!order) return;
    retryPaymentMutation.mutate();
  }

  async function handleCancel() {
    if (!order) return;
    const isCOD = order.status === "cod_confirmed";
    const message = isCOD
      ? "Cancel this order? This cannot be undone."
      : "Cancel this order? Since it's already paid, this will submit a refund request for our team to review — it won't refund automatically.";
    if (!confirm(message)) return;
    cancelMutation.mutate();
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 py-24">
        <Spinner size="lg" />
        <p className="mt-4 text-sm font-medium text-slate-500">
          Retrieving order details...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 py-24">
        <div className="mx-auto max-w-md text-center rounded-3xl border border-slate-200 bg-white p-12 shadow-xl shadow-slate-200/40">
          <h2 className="text-xl font-bold text-slate-900">Order Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">
            We couldn&rsquo;t find the order you&rsquo;re looking for or you may
            not have authorization to view it.
          </p>
          <Link
            href="/orders"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            ← Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const canCancel =
    order.status === "cod_confirmed" ||
    order.status === "paid" ||
    order.status === "preparing";
  const canRetryPayment =
    order.status === "pending_payment" || order.status === "payment_failed";

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Navigation Breadcrumb */}
        <Link
          href="/orders"
          className="group mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
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
          Back to all orders
        </Link>

        {/* Order Header Card */}
        {/* FIX: bg-white instead of bg-white/80 */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Order #{order.order_id}
                </h1>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Placed on{" "}
                <span className="font-medium text-slate-700">
                  {formatDate(order.created_at)}
                </span>
              </p>
            </div>

            {/* Quick Actions in Header if applicable */}
            <div className="flex gap-3">
              {canRetryPayment && (
                <button
                  onClick={handleRetryPayment}
                  disabled={retrying}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:from-indigo-500 hover:to-indigo-400 hover:shadow-indigo-500/35 disabled:opacity-50"
                >
                  {retrying
                    ? "Redirecting..."
                    : order.status === "payment_failed"
                      ? "Retry Payment"
                      : "Continue to Payment"}
                </button>
              )}
              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="inline-flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
                >
                  {cancelling ? "Cancelling..." : "Cancel Order"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Purchased Items Card */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/40">
            <h2 className="mb-6 text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              Items Ordered
            </h2>

            <div className="flex flex-col divide-y divide-slate-100">
              {order.items.map((item) => {
                const product = productMap[item.product_id];
                const variant = product?.variants.find(
                  (v) => v.variant_id === item.variant_id,
                );
                const image =
                  variant?.images?.[0]?.s3_url ?? product?.images?.[0]?.s3_url;

                return (
                  <div
                    key={`${item.product_id}-${item.variant_id}`}
                    className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={product?.name ?? "Product"}
                        className="h-20 w-20 shrink-0 rounded-2xl border border-slate-100 bg-slate-50 object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <svg
                          className="h-8 w-8"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col justify-between sm:flex-row sm:items-center">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {product?.name ?? `Product #${item.product_id}`}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {variant?.name ?? `Variant #${item.variant_id}`}
                          <span className="mx-2 text-slate-300">•</span>
                          Qty:{" "}
                          <span className="font-semibold text-slate-700">
                            {item.quantity}
                          </span>
                        </p>
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-900 sm:mt-0">
                        {formatPrice(item.subtotal)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Breakdown */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
              <span className="text-base font-medium text-slate-600">
                Total Amount
              </span>
              <span className="text-2xl font-extrabold text-indigo-600">
                {formatPrice(order.total_amount)}
              </span>
            </div>
          </section>

          {/* Delivery & Logistics Card */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/40">
            <h2 className="mb-4 text-lg font-bold text-slate-900 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Delivery Address
            </h2>

            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <p className="text-sm font-medium text-slate-700">
                {order.shipping_address}
              </p>
              {order.shipping?.tracking_code && (
                <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3">
                  <span className="text-xs text-slate-400">Tracking Code:</span>
                  <span className="rounded-md bg-slate-200 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                    {order.shipping.tracking_code}
                  </span>
                </div>
              )}
            </div>

            {/* Tracking Status Logs */}
            {trackingLogs.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Shipment Logs
                </h3>
                <div className="space-y-2">
                  {trackingLogs.map((log, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs border border-slate-100"
                    >
                      <span className="font-semibold text-slate-700 capitalize flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        {log.status}
                      </span>
                      <span className="text-slate-400">
                        {formatDateTime(log.updated_date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
