import Badge, { type BadgeVariant } from "../ui/Badge";
import type { OrderStatus } from "../../interfaces";

const STATUS_MAP: Record<
  OrderStatus,
  { label: string; variant: BadgeVariant }
> = {
  pending_payment: { label: "Pending Payment", variant: "warning" },
  paid: { label: "Paid", variant: "info" },
  preparing: { label: "Preparing", variant: "info" },
  shipping: { label: "Shipping", variant: "info" },
  delivered: { label: "Delivered", variant: "success" },
  cancelled: { label: "Cancelled", variant: "error" },
  payment_failed: { label: "Payment Failed", variant: "error" },
  refund_requested: { label: "Refund Requested", variant: "warning" },
  refunded: { label: "Refunded", variant: "default" },
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, variant } = STATUS_MAP[status] ?? {
    label: status,
    variant: "default" as BadgeVariant,
  };
  return <Badge variant={variant}>{label}</Badge>;
}
