"use client";

import { useState, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, Check, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { cartService } from "@/services/cart.service";
import { useCartStore } from "@/store/useCartStore";
import { toast } from "@/components/ui/Toast";
import type { ChatProductCardData } from "@/interfaces";

/**
 * Compact product card for chat search results. Reuses the same visual
 * language as components/product/ProductCard.tsx (rounded image tile,
 * same price formatting) rather than inventing a one-off style, but isn't
 * literally the same component — ProductCard requires rating/discount
 * data that search_products' ProductCard (backend) doesn't return.
 *
 * "Add to cart" hits POST /cart/items directly (cartService.addItem)
 * rather than round-tripping through the model — the card already has the
 * exact (product_id, variant_id) pair from search_products, so there's
 * nothing left to disambiguate. This is what actually makes the button
 * work: previously the card only rendered name/price with no action at
 * all, and the only way to add anything to cart was to ask the assistant
 * to do it in a follow-up message.
 */
export default function ChatProductCard({
  product_id,
  variant_id,
  name,
  price,
  image_url,
  url,
}: ChatProductCardData) {
  const router = useRouter();
  const setCartData = useCartStore((s) => s.setCartData);
  const [status, setStatus] = useState<"idle" | "adding" | "added">("idle");

  async function handleAddToCart(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (variant_id == null || status !== "idle") return;
    setStatus("adding");
    try {
      const cart = await cartService.addItem({
        product_id,
        variant_id,
        quantity: 1,
      });
      setCartData(cart.items, cart.total);
      setStatus("added");
      toast.success(`Added "${name}" to cart.`);
    } catch {
      setStatus("idle");
      toast.error("Couldn't add that to your cart — please try again.");
    }
  }

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 transition-shadow hover:shadow-sm">
      <Link
        href={url}
        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F0EEED]"
      >
        <Image
          src={image_url ?? "/images/landing_img.jpg"}
          alt={name}
          fill
          className="object-cover object-center"
        />
      </Link>
      <Link href={url} className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-black">{name}</p>
        <p className="text-sm font-semibold text-black">
          {price != null ? formatPrice(price) : "Contact for price"}
        </p>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={variant_id == null || status !== "idle"}
          title={variant_id == null ? "No purchasable variant" : "Add to cart"}
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
            status === "added"
              ? "border-green-500 bg-green-50 text-green-600"
              : "border-black text-black hover:bg-black/5"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {status === "adding" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : status === "added" ? (
            <Check size={14} />
          ) : (
            <ShoppingCart size={14} />
          )}
        </button>
        {status === "added" && (
          <button
            type="button"
            onClick={() => router.push("/cart")}
            className="rounded-full bg-black px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-gray-800"
          >
            View cart
          </button>
        )}
      </div>
    </div>
  );
}
