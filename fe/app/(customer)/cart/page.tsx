"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/store/useAuthStore";
import { useCartStore } from "@/store/useCartStore";
import { cartService } from "@/services/cart.service";
import { toast } from "@/components/ui/Toast";
import type { CartItem } from "@/interfaces";

export default function CartPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const { items, setItems, updateItem, removeItem, clearItems, totalCount } =
    useCartStore();

  const [loading, setLoading] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  // On mount: if logged in, sync server cart → local store
  useEffect(() => {
    if (!accessToken) return;

    setLoading(true);
    cartService
      .getCart()
      .then((cartItems) => setItems(cartItems)) // getCart() returns CartItem[] directly
      .catch(() => toast.error("Failed to load cart"))
      .finally(() => setLoading(false));
  }, [accessToken, setItems]);

  const itemKey = (item: CartItem) => `${item.product_id}-${item.variant_id}`;

  const handleQuantityChange = async (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;

    const key = itemKey(item);
    setUpdatingKey(key);

    try {
      if (accessToken) {
        await cartService.updateItem({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: newQty,
        });
        // Re-fetch to get authoritative unit_price/subtotal from server
        const cartItems = await cartService.getCart();
        setItems(cartItems);
      } else {
        updateItem(item.product_id, item.variant_id, newQty);
      }
    } catch {
      toast.error("Failed to update quantity");
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleRemove = async (item: CartItem) => {
    const key = itemKey(item);
    setUpdatingKey(key);

    try {
      if (accessToken) {
        await cartService.removeItem({
          product_id: item.product_id,
          variant_id: item.variant_id,
        });
        const cartItems = await cartService.getCart();
        setItems(cartItems);
      } else {
        removeItem(item.product_id, item.variant_id);
      }
    } catch {
      toast.error("Failed to remove item");
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleClear = async () => {
    try {
      if (accessToken) {
        await cartService.clearCart();
      }
      clearItems();
    } catch {
      toast.error("Failed to clear cart");
    }
  };

  const handleCheckout = () => {
    if (!accessToken) {
      // Header picks up ?login=1 to open login modal
      router.push("/?login=1");
      return;
    }
    router.push("/checkout");
  };

  const total = items.reduce((sum, item) => sum + Number(item.subtotal), 0);

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (!loading && items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="mb-6 text-lg text-gray-400">Your cart is empty.</p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Cart{" "}
          <span className="text-base font-normal text-gray-400">
            ({totalCount()} item{totalCount() !== 1 ? "s" : ""})
          </span>
        </h1>
        {items.length > 0 && (
          <button
            onClick={handleClear}
            className="text-sm text-red-400 hover:text-red-300"
          >
            Clear all
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-24 text-center text-gray-400">Loading cart…</div>
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* ─── Item list ─────────────────────────────────────────────── */}
          <ul className="flex flex-1 flex-col gap-4">
            {items.map((item) => {
              const key = itemKey(item);
              const busy = updatingKey === key;

              return (
                <li
                  key={key}
                  className={`flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-opacity ${
                    busy ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {/* Image */}
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-800">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.product_name ?? "Product image"}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <p className="font-semibold leading-snug">
                        {item.product_name ?? `Product #${item.product_id}`}
                      </p>
                      {item.variant_name && (
                        <p className="mt-0.5 text-sm text-gray-400">
                          {item.variant_name}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Quantity stepper */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(item, -1)}
                          disabled={item.quantity <= 1}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-lg leading-none hover:bg-white/10 disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item, 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-lg leading-none hover:bg-white/10"
                        >
                          +
                        </button>
                      </div>

                      {/* Subtotal + remove */}
                      <div className="flex items-center gap-4">
                        <p className="text-sm font-semibold">
                          {Number(item.subtotal).toLocaleString("vi-VN")}₫
                        </p>
                        <button
                          onClick={() => handleRemove(item)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ─── Order summary ──────────────────────────────────────────── */}
          <aside className="w-full shrink-0 lg:w-72">
            <div className="sticky top-6 rounded-xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>

              <div className="flex flex-col gap-2 text-sm">
                {items.map((item) => (
                  <div
                    key={itemKey(item)}
                    className="flex justify-between text-gray-400"
                  >
                    <span className="max-w-[160px] truncate">
                      {item.product_name ?? `#${item.product_id}`} ×{" "}
                      {item.quantity}
                    </span>
                    <span>
                      {Number(item.subtotal).toLocaleString("vi-VN")}₫
                    </span>
                  </div>
                ))}
              </div>

              <div className="my-4 border-t border-white/10" />

              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{total.toLocaleString("vi-VN")}₫</span>
              </div>

              <p className="mt-1 text-xs text-gray-500">
                Shipping calculated at checkout
              </p>

              <button
                onClick={handleCheckout}
                className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-95"
              >
                {accessToken ? "Proceed to Checkout" : "Sign in to Checkout"}
              </button>

              <Link
                href="/"
                className="mt-3 block text-center text-xs text-gray-400 hover:text-gray-300"
              >
                Continue shopping
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
