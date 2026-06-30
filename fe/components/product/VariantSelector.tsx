"use client";

import { clsx } from "clsx";
import type { ProductVariant } from "../../interfaces";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedId: number | null;
  onSelect: (variant: ProductVariant) => void;
}

export default function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: VariantSelectorProps) {
  if (!variants.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700">Variant</p>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const outOfStock = !v.stock || v.stock === 0;
          return (
            <button
              key={v.variant_id}
              onClick={() => !outOfStock && onSelect(v)}
              disabled={outOfStock}
              title={outOfStock ? "Out of stock" : v.name}
              className={clsx(
                "rounded-lg border px-4 py-2 text-sm transition",
                v.variant_id === selectedId
                  ? "border-black bg-black text-white"
                  : "border-gray-300 text-gray-700 hover:border-gray-500",
                outOfStock && "cursor-not-allowed opacity-40 line-through",
              )}
            >
              {v.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
