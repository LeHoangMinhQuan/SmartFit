import type { Discount } from "../../interfaces";
import { formatPrice } from "../../lib/utils";

interface PriceDisplayProps {
  basePrice: number;
  discount?: Discount | null;
  /** "lg" (default) for the product detail page; "sm" for compact
   * contexts — product cards, search dropdown, wishlist, chat widget. */
  size?: "sm" | "lg";
}

function calcDiscounted(base: number, d: Discount): number {
  if (d.voucher_type === "percent") {
    return Math.max(0, base - (base * d.voucher_value) / 100);
  }
  return Math.max(0, base - d.voucher_value);
}

const SIZES = {
  lg: {
    gap: "gap-3",
    price: "text-2xl font-bold",
    original: "text-base text-gray-400 line-through",
    badge: "text-xs px-1.5 py-0.5",
  },
  sm: {
    gap: "gap-2",
    price: "text-base font-bold",
    original: "text-xs text-gray-400 line-through",
    badge: "text-[10px] px-1 py-0.5",
  },
} as const;

export default function PriceDisplay({
  basePrice,
  discount,
  size = "lg",
}: PriceDisplayProps) {
  const discounted = discount ? calcDiscounted(basePrice, discount) : null;
  const s = SIZES[size];

  return (
    <div className={`flex items-baseline flex-wrap ${s.gap}`}>
      {discounted !== null ? (
        <>
          <span className={`${s.price} text-red-600`}>
            {formatPrice(discounted)}
          </span>
          <span className={s.original}>{formatPrice(basePrice)}</span>
          <span
            className={`rounded bg-red-100 font-semibold text-red-600 ${s.badge}`}
          >
            -
            {discount!.voucher_type === "percent"
              ? `${discount!.voucher_value}%`
              : formatPrice(discount!.voucher_value)}
          </span>
        </>
      ) : (
        <span className={`${s.price} text-gray-900`}>
          {formatPrice(basePrice)}
        </span>
      )}
    </div>
  );
}
