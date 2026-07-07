import Link from "next/link";
import type { Order, OrderStatus } from "@/interfaces";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pending Payment",
  paid: "Paid",
  preparing: "Preparing",
  shipping: "Shipping",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment Failed",
  refund_requested: "Refund Requested",
  refunded: "Refunded",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_payment: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  paid: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  preparing: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  shipping: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  delivered: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  payment_failed: "bg-red-500/15 text-red-400 border-red-500/30",
  refund_requested: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  refunded: "bg-teal-500/15 text-teal-400 border-teal-500/30",
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── OrderCard ────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: Order;
}

export default function OrderCard({ order }: OrderCardProps) {
  const itemCount = order.items?.length ?? 0;
  const formattedDate = new Date(order.created_at).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Link
      href={`/orders/${order.order_id}`}
      className="block rounded-xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-white/20 hover:bg-white/10"
    >
      {/* Top row — order ID + status */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">
            Order{" "}
            <span className="font-mono text-gray-300">#{order.order_id}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{formattedDate}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Middle row — item count + shipping address */}
      <div className="mt-3 flex flex-col gap-1 text-sm text-gray-400">
        <p>
          {itemCount} item{itemCount !== 1 ? "s" : ""}
          {order.shipping_address ? ` · ${order.shipping_address}` : ""}
        </p>
      </div>

      {/* Bottom row — total */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-gray-500">Total</p>
        <p className="text-sm font-semibold">
          {Number(order.total_amount).toLocaleString("vi-VN")}₫
        </p>
      </div>
    </Link>
  );
}

export { OrderStatusBadge };
