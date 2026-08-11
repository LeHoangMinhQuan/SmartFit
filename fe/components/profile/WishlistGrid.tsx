"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { wishlistService } from "../../services/wishlist.service";
import { useWishlistStore } from "../../store/useWishlistStore";
import { toast } from "../ui/Toast";
import Spinner from "../ui/Spinner";
import { Heart, Trash2 } from "lucide-react";
import type { WishlistItem } from "../../interfaces";
import PriceDisplay from "../product/PriceDisplay";

export default function WishlistGrid() {
  const queryClient = useQueryClient();
  const setStoreItems = useWishlistStore((s) => s.setItems);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const itemKey = (item: WishlistItem) =>
    `${item.product_id}-${item.variant_id}`;

  const {
    data: items = [],
    isLoading: loading,
    isError,
  } = useQuery({
    queryKey: ["wishlist"],
    queryFn: async () => {
      const data = await wishlistService.getWishlist();
      setStoreItems(data);
      return data;
    },
  });

  useEffect(() => {
    if (isError) toast.error("Failed to load wishlist.");
  }, [isError]);

  const removeMutation = useMutation({
    mutationFn: (item: WishlistItem) =>
      wishlistService.removeFromWishlist(item.product_id, item.variant_id),
    onMutate: (item) => setRemovingKey(itemKey(item)),
    onSuccess: (_data, item) => {
      queryClient.setQueryData(
        ["wishlist"],
        (prev: WishlistItem[] | undefined) =>
          (prev ?? []).filter((i) => itemKey(i) !== itemKey(item)),
      );
      useWishlistStore.getState().removeItem(item.product_id, item.variant_id);
      toast.success("Removed from wishlist.");
    },
    onError: () => toast.error("Failed to remove item."),
    onSettled: () => setRemovingKey(null),
  });

  async function handleRemove(item: WishlistItem) {
    removeMutation.mutate(item);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size="md" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200/50">
          <Heart className="h-8 w-8 text-slate-400" />
        </div>
        <div>
          <p className="text-base font-medium text-slate-900">
            Your wishlist is empty
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Save items you love to review them later.
          </p>
        </div>
        <Link
          href="/"
          className="mt-2 rounded-xl bg-white border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2">
      {items.map((item) => {
        const key = itemKey(item);
        const busy = removingKey === key;
        const hasPrice = item.base_price != null;

        return (
          <div
            key={key}
            className={`flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md ${
              busy ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <Link
              href={`/product/${item.product_id}`}
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100"
            >
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.product_name ?? "Product image"}
                  fill
                  className="object-cover transition-transform duration-300 hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                  No image
                </div>
              )}
            </Link>

            <div className="flex flex-1 flex-col justify-between">
              <div>
                <Link
                  href={`/product/${item.product_id}`}
                  className="font-semibold leading-tight text-slate-900 transition hover:text-indigo-600 line-clamp-2"
                >
                  {item.product_name ?? `Product #${item.product_id}`}
                </Link>
                {item.variant_name && (
                  <p className="mt-1 text-xs text-slate-500">
                    {item.variant_name}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                {hasPrice ? (
                  <PriceDisplay
                    basePrice={Number(item.base_price)}
                    discount={item.discount}
                    size="sm"
                  />
                ) : (
                  <span className="text-sm font-bold text-slate-900">—</span>
                )}
                <button
                  onClick={() => handleRemove(item)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  aria-label="Remove from wishlist"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
