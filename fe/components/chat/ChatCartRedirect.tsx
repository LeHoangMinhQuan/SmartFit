"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, CreditCard } from "lucide-react";
import { cartService } from "@/services/cart.service";
import { useCartStore } from "@/store/useCartStore";

interface ChatCartRedirectProps {
  cartUrl: string;
}

/**
 * Rendered off a completed tool-add_to_cart part. The item was already
 * added server-side by the backend's add_to_cart tool call.
 *
 * BUG FIX: this used to assume navigating to /cart or /checkout was enough
 * to pick up the new item, since those pages each refetch on their own
 * mount. That's true for their own content, but the header's cart badge
 * (components/layout/Header.tsx) reads straight off useCartStore with no
 * refetch of its own — it only ever updates via an explicit setCartData/
 * addItem call. Since the LLM's add_to_cart tool call happens entirely
 * server-side (chat.service.ts -> CartService.addItem, bypassing the
 * frontend's own POST /cart/items call that ChatProductCard.tsx's
 * "add to cart" button uses), nothing was ever telling useCartStore an
 * item had been added — so the header badge stayed stale until the
 * customer happened to land on /cart or /checkout. Pulling the
 * authoritative cart here, right when this confirmation renders, closes
 * that gap without needing the customer to navigate anywhere first.
 *
 * Two actions, not one: "View Cart" alone was the whole feature before —
 * flagged as missing a direct path to checkout. /checkout is the existing
 * page as-is (pick a saved address or enter a new one) — this doesn't
 * attempt to skip that step or prefill it; it just gets the customer
 * there in one tap instead of cart -> checkout.
 */
export default function ChatCartRedirect({ cartUrl }: ChatCartRedirectProps) {
  const router = useRouter();
  const setCartData = useCartStore((s) => s.setCartData);

  useEffect(() => {
    let cancelled = false;
    cartService
      .getCart()
      .then((cart) => {
        if (!cancelled) setCartData(cart.items, cart.total);
      })
      .catch((err) => {
        // Non-fatal — the header badge just stays stale for this one
        // confirmation; /cart and /checkout's own fetches still recover.
        console.error("[ChatCartRedirect] cart refresh failed:", err);
      });
    return () => {
      cancelled = true;
    };
    // Runs once per rendered confirmation, not on every setCartData call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => router.push(cartUrl)}
        className="flex items-center gap-2 rounded-full border border-black px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black/5"
      >
        <ShoppingCart size={16} />
        View cart
      </button>
      <button
        onClick={() => router.push("/checkout")}
        className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
      >
        <CreditCard size={16} />
        Checkout now
      </button>
    </div>
  );
}
