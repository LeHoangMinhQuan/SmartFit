"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { orderService } from "../../../../services/order.service";
import { productService } from "../../../../services/product.service";
import { shippingService } from "../../../../services/shipping.service";
import { useAuthStore } from "../../../../store/useAuthStore";
import { formatDate, formatDateTime, formatPrice } from "../../../../lib/utils";
import { toast } from "../../../../components/ui/Toast";
import Spinner from "../../../../components/ui/Spinner";
import OrderStatusBadge from "../../../../components/order/OrderStatusBadge";
import type { Order, Product, ShippingLog } from "../../../../interfaces";

interface Props {
  params: { order_id: string };
}

export default function OrderDetailPage({ params }: Props) {
  const orderId = Number(params.order_id);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [order, setOrder] = useState<Order | null>(null);
  // order_item has no name/image snapshot — enrich from product_id lookups
  const [productMap, setProductMap] = useState<Record<number, Product>>({});
  const [trackingLogs, setTrackingLogs] = useState<ShippingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    orderService
      .getOrder(orderId)
      .then(async (o) => {
        setOrder(o);

        // Bulk-fetch distinct products referenced in order_item
        const distinctIds = Array.from(
          new Set(o.items.map((i) => i.product_id)),
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
        setProductMap(map);

        // Tracking — only if a shipping order exists
        if (o.shipping?.tracking_code) {
          shippingService
            .trackOrder(o.shipping.tracking_code)
            .then(setTrackingLogs)
            .catch(() => {});
        }
      })
      .catch(() => toast.error("Failed to load order."))
      .finally(() => setLoading(false));
  }, [user, orderId]);

  async function handleCancel() {
    if (!order) return;
    if (!confirm("Cancel this order? This cannot be undone.")) return;
    setCancelling(true);
    try {
      await orderService.cancelOrder(order.order_id);
      setOrder({ ...order, status: "cancelled" });
      toast.success("Order cancelled.");
    } catch {
      toast.error("Failed to cancel order.");
    } finally {
      setCancelling(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-24 text-center text-gray-500">Order not found.</div>
    );
  }

  const canCancel = order.status === "paid" || order.status === "preparing";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order #{order.order_id}</h1>
          <p className="text-sm text-gray-500">
            Placed on {formatDate(order.created_at)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Items */}
      <section className="mb-8 rounded-xl border p-5">
        <h2 className="mb-4 font-semibold">Items</h2>
        <div className="flex flex-col divide-y">
          {order.items.map((item) => {
            const product = productMap[item.product_id];
            const variant = product?.variants.find(
              (v) => v.variant_id === item.variant_id,
            );
            const image =
              variant?.images[0]?.s3_url ?? product?.images[0]?.s3_url;

            return (
              <div
                key={`${item.product_id}-${item.variant_id}`}
                className="flex gap-4 py-4 first:pt-0 last:pb-0"
              >
                {image ? (
                  <img
                    src={image}
                    alt={product?.name ?? "Product"}
                    className="h-16 w-16 shrink-0 rounded-lg bg-gray-100 object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-100" />
                )}
                <div className="flex flex-1 items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {product?.name ?? `Product #${item.product_id}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {variant?.name ?? `Variant #${item.variant_id}`} ×{" "}
                      {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatPrice(item.subtotal)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-between border-t pt-4 font-semibold">
          <span>Total</span>
          <span>{formatPrice(order.total_amount)}</span>
        </div>
      </section>

      {/* Shipping */}
      <section className="mb-8 rounded-xl border p-5">
        <h2 className="mb-3 font-semibold">Delivery</h2>
        <p className="text-sm text-gray-600">{order.shipping_address}</p>

        {order.shipping?.tracking_code && (
          <p className="mt-2 text-xs text-gray-400">
            Tracking code: {order.shipping.tracking_code}
          </p>
        )}

        {trackingLogs.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t pt-4">
            {trackingLogs.map((log, i) => (
              <div
                key={i}
                className="flex justify-between text-xs text-gray-500"
              >
                <span className="capitalize">{log.status}</span>
                <span>{formatDateTime(log.updated_date)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      {canCancel && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="rounded-lg border border-red-300 px-5 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {cancelling ? "Cancelling…" : "Cancel Order"}
        </button>
      )}
    </div>
  );
}
