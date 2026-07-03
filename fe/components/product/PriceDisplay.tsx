import type { Discount } from "../../interfaces";
import { formatPrice } from "../../lib/utils";

interface PriceDisplayProps {
  basePrice: number;
  discount?: Discount | null;
}

function calcDiscounted(base: number, d: Discount): number {
  if (d.voucher_type === "percent") {
    return Math.max(0, base - (base * d.voucher_value) / 100);
  }
  return Math.max(0, base - d.voucher_value);
}

export default function PriceDisplay({
  basePrice,
  discount,
}: PriceDisplayProps) {
  const discounted = discount ? calcDiscounted(basePrice, discount) : null;

  return (
    <div className="flex items-baseline gap-3">
      {discounted !== null ? (
        <>
          <span className="text-2xl font-bold text-red-600">
            {formatPrice(discounted)}
          </span>
          <span className="text-base text-gray-400 line-through">
            {formatPrice(basePrice)}
          </span>
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-600">
            -{discount!.voucher_value}
            {discount!.voucher_type === "percent" ? "%" : "₫"}
          </span>
        </>
      ) : (
        <span className="text-2xl font-bold">{formatPrice(basePrice)}</span>
      )}
    </div>
  );
}
