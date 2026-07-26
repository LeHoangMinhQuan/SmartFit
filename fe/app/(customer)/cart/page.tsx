"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { useAuthModalStore } from "@/store/useAuthModalStore";
import { useCartStore } from "@/store/useCartStore";
import { cartService } from "@/services/cart.service";
import { toast } from "@/components/ui/Toast";
import Spinner from "@/components/ui/Spinner";
import { formatPrice } from "@/lib/utils";
import { LogIn, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import type { CartItem } from "@/interfaces";

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const {
    items,
    total,
    setCartData,
    updateItem,
    removeItem,
    clearItems,
    totalCount,
  } = useCartStore();

  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  // On mount (and whenever the user logs in): sync server cart → local store.
  const { isLoading: loading } = useQuery({
    queryKey: ["cart", user?.user_id],
    queryFn: async () => {
      const cart = await cartService.getCart();
      setCartData(cart.items, cart.total);
      return cart;
    },
    enabled: !!user,
  });

  const updateItemMutation = useMutation({
    mutationFn: (vars: {
      product_id: number;
      variant_id: number;
      quantity: number;
    }) => cartService.updateItem(vars),
    onSuccess: (cart) => {
      // updateItem already returns the full authoritative cart — no need
      // for a second GET /cart round trip.
      setCartData(cart.items, cart.total);
      queryClient.setQueryData(["cart", user?.user_id], cart);
    },
    onError: () => toast.error("Failed to update quantity"),
  });

  const removeItemMutation = useMutation({
    mutationFn: (vars: { product_id: number; variant_id: number }) =>
      cartService.removeItem(vars),
    onSuccess: (cart) => {
      setCartData(cart.items, cart.total);
      queryClient.setQueryData(["cart", user?.user_id], cart);
    },
    onError: () => toast.error("Failed to remove item"),
  });

  const clearCartMutation = useMutation({
    mutationFn: () => cartService.clearCart(),
    onSuccess: () => {
      clearItems();
      queryClient.invalidateQueries({ queryKey: ["cart", user?.user_id] });
    },
    onError: () => toast.error("Failed to clear cart"),
  });

  const itemKey = (item: CartItem) => `${item.product_id}-${item.variant_id}`;

  const handleQuantityChange = async (item: CartItem, delta: number) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;

    const key = itemKey(item);
    setUpdatingKey(key);

    try {
      if (user) {
        await updateItemMutation.mutateAsync({
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: newQty,
        });
      } else {
        updateItem(item.product_id, item.variant_id, newQty);
      }
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleRemove = async (item: CartItem) => {
    const key = itemKey(item);
    setUpdatingKey(key);

    try {
      if (user) {
        await removeItemMutation.mutateAsync({
          product_id: item.product_id,
          variant_id: item.variant_id,
        });
      } else {
        removeItem(item.product_id, item.variant_id);
      }
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleClear = async () => {
    try {
      if (user) {
        await clearCartMutation.mutateAsync();
      } else {
        clearItems();
      }
    } catch {
      // toasted in mutation onError
    }
  };

  const handleCheckout = () => {
    if (!user) {
      // LoginModal is mounted globally in Header — just open it here.
      // handleCheckout intentionally does NOT auto-continue to /checkout
      // once signed in, matching the pattern used on the product page's
      // "Sign In to Try It On" action.
      openLogin();
      return;
    }
    router.push("/checkout");
  };

  // `total` comes straight from the store (server-computed for logged-in
  // users via setCartData, locally derived for guests) — no per-render
  // reduce needed here.

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-10">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center rounded-3xl bg-white shadow-sm border border-slate-200">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
            <ShoppingBag className="h-7 w-7 text-indigo-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Your cart is empty
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Looks like you haven&apos;t added anything yet.
          </p>
          <Link
            href="/"
            className="mt-8 inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-6xl px-6 py-10 rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Cart{" "}
            <span className="text-base font-normal text-slate-400">
              ({totalCount()} item{totalCount() !== 1 ? "s" : ""})
            </span>
          </h1>
          <button
            onClick={handleClear}
            className="text-sm font-medium text-red-500 hover:text-red-600"
          >
            Clear all
          </button>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* ─── Item list ─────────────────────────────────────────────── */}
          <ul className="flex flex-col gap-4 lg:col-span-2">
            {items.map((item) => {
              const key = itemKey(item);
              const busy = updatingKey === key;

              return (
                <li
                  key={key}
                  className={`flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-opacity ${
                    busy ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {/* Image */}
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.product_name ?? "Product image"}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        No image
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <p className="font-semibold leading-snug text-slate-900">
                        {item.product_name ?? `Product #${item.product_id}`}
                      </p>
                      {item.variant_name && (
                        <p className="mt-0.5 text-sm text-slate-500">
                          {item.variant_name}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Quantity stepper */}
                      <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white shadow-sm">
                        <button
                          onClick={() => handleQuantityChange(item, -1)}
                          disabled={item.quantity <= 1}
                          className="flex h-9 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-100 disabled:opacity-30"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-medium text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(item, 1)}
                          className="flex h-9 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-100"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Subtotal + remove */}
                      <div className="flex items-center gap-4">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatPrice(Number(item.subtotal))}
                        </p>
                        <button
                          onClick={() => handleRemove(item)}
                          aria-label="Remove item"
                          className="text-slate-400 transition hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* ─── Order summary ──────────────────────────────────────────── */}
          <aside className="lg:col-span-1">
            <div className="sticky top-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Order Summary
              </h2>

              <div className="flex flex-col gap-2 text-sm">
                {items.map((item) => (
                  <div
                    key={itemKey(item)}
                    className="flex justify-between text-slate-500"
                  >
                    <span className="max-w-[160px] truncate">
                      {item.product_name ?? `#${item.product_id}`} ×{" "}
                      {item.quantity}
                    </span>
                    <span>{formatPrice(Number(item.subtotal))}</span>
                  </div>
                ))}
              </div>

              <div className="my-4 border-t border-slate-200" />

              <div className="flex justify-between font-semibold text-slate-900">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>

              <p className="mt-1 text-xs text-slate-400">
                Shipping calculated at checkout
              </p>

              {!user && (
                <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-900">
                  Sign in to checkout — your cart will carry over.
                </div>
              )}

              <button
                onClick={handleCheckout}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30"
              >
                {user ? (
                  "Proceed to Checkout"
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign In to Checkout
                  </>
                )}
              </button>

              <Link
                href="/"
                className="mt-3 block text-center text-xs text-slate-500 hover:text-slate-700"
              >
                Continue shopping
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
