import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { ChatProductCardData } from "@/interfaces";

/**
 * Compact product card for chat search results. Reuses the same visual
 * language as components/product/ProductCard.tsx (rounded image tile,
 * same price formatting) rather than inventing a one-off style, but isn't
 * literally the same component — ProductCard requires rating/discount
 * data that search_products' ProductCard (backend) doesn't return.
 */
export default function ChatProductCard({
  name,
  price,
  image_url,
  url,
}: ChatProductCardData) {
  return (
    <Link
      href={url}
      className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 transition-shadow hover:shadow-sm"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F0EEED]">
        <Image
          src={image_url ?? "/images/landing_img.jpg"}
          alt={name}
          fill
          className="object-cover object-center"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium text-black">{name}</p>
        <p className="text-sm font-semibold text-black">
          {price != null ? formatPrice(price) : "Contact for price"}
        </p>
      </div>
    </Link>
  );
}
