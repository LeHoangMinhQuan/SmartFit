"use client";

import { useRouter } from "next/navigation";
import { ShoppingCart, CreditCard } from "lucide-react";

interface ChatCartRedirectProps {
  cartUrl: string;
}

/**
 * Rendered off a completed tool-add_to_cart part. The item was already
 * added server-side by the backend's add_to_cart tool call — navigating
 * to either destination just triggers the existing refetch-on-mount
 * (useCartStore for /cart, the checkout page's own cart/address load for
 * /checkout), so the new item shows up without any extra wiring
 * (ecommerce-fe-plan.md §11).
 *
 * Two actions, not one: "View Cart" alone was the whole feature before —
 * flagged as missing a direct path to checkout. /checkout is the existing
 * page as-is (pick a saved address or enter a new one) — this doesn't
 * attempt to skip that step or prefill it; it just gets the customer
 * there in one tap instead of cart -> checkout.
 */
export default function ChatCartRedirect({ cartUrl }: ChatCartRedirectProps) {
  const router = useRouter();

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
