"use client";

import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";

interface ChatCartRedirectProps {
  cartUrl: string;
}

/**
 * Rendered off a completed tool-add_to_cart part. The item was already
 * added server-side by the backend's add_to_cart tool call — navigating
 * here just triggers useCartStore's existing refetch-on-mount, so the new
 * item shows up on /cart without any extra wiring (ecommerce-fe-plan.md §11).
 */
export default function ChatCartRedirect({ cartUrl }: ChatCartRedirectProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(cartUrl)}
      className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
    >
      <ShoppingCart size={16} />
      Added to cart — view cart
    </button>
  );
}
