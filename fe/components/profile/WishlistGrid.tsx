"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { wishlistService } from "../../services/wishlist.service";
import { useWishlistStore } from "../../store/useWishlistStore";
import { toast } from "../ui/Toast";
import Spinner from "../ui/Spinner";
import { formatPrice } from "../../lib/utils";
import { Heart } from "lucide-react";
import type { WishlistItem } from "../../interfaces";

export default function WishlistGrid() {
  const setStoreItems = useWishlistStore((s) => s.setItems);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const itemKey = (item: WishlistItem) =>
    `${item.product_id}-${item.variant_id}`;

  async function refresh() {
    try {
      const data = await wishlistService.getWishlist();
      setItems(data);
      // Keep the global store (used for the heart icon on product pages)
      // in sync with what's actually on the server.
      setStoreItems(data);
    } catch {
      toast.error("Failed to load wishlist.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRemove(item: WishlistItem) {
    const key = itemKey(item);
    setRemovingKey(key);
    try {
      await wishlistService.removeFromWishlist(
        item.product_id,
        item.variant_id,
      );
      setItems((prev) => prev.filter((i) => itemKey(i) !== key));
      useWishlistStore.getState().removeItem(item.product_id, item.variant_id);
      toast.success("Removed from wishlist.");
    } catch {
      toast.error("Failed to remove item.");
    } finally {
      setRemovingKey(null);
    }
  }

  if (loading) return <Spinner />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 py-16 text-center">
        <Heart className="h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-500">Your wishlist is empty.</p>
        <Link
          href="/"
          className="text-sm font-medium text-blue-500 hover:underline"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((item) => {
        const key = itemKey(item);
        const busy = removingKey === key;
        const price =
          item.base_price != null ? formatPrice(Number(item.base_price)) : null;

        return (
          <div
            key={key}
            className={`flex gap-4 rounded-xl border p-4 transition-opacity ${
              busy ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <Link
              href={`/product/${item.product_id}`}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100"
            >
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.product_name ?? "Product image"}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                  No image
                </div>
              )}
            </Link>

            <div className="flex flex-1 flex-col justify-between">
              <div>
                <Link
                  href={`/product/${item.product_id}`}
                  className="font-medium text-gray-800 hover:underline"
                >
                  {item.product_name ?? `Product #${item.product_id}`}
                </Link>
                {item.variant_name && (
                  <p className="mt-0.5 text-sm text-gray-500">
                    {item.variant_name}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">
                  {price ?? "—"}
                </span>
                <button
                  onClick={() => handleRemove(item)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
