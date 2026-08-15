"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/services/product.service";
import { ProductCardProps, ProductSummary } from "@/interfaces";
import Carousel from "@/components/Carousel";
import Spinner from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toast";

function toCardProps(p: ProductSummary): ProductCardProps {
  return {
    id: p.product_id,
    name: p.name,
    price: p.price ?? 0,
    originalPrice: p.originalPrice,
    discount:
      p.discountActive && p.originalPrice != null && p.price != null
        ? Math.round((1 - p.price / p.originalPrice) * 100)
        : undefined,
    rating: p.avg_rating ?? 0,
    imageUrl: p.image ?? undefined,
  };
}

export default function TopSellingSection() {
  const {
    data: topSelling = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["products", "top-selling", 8],
    queryFn: () => productService.getTopSelling(8),
  });

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load top selling products.");
      console.error(error);
    }
  }, [isError]);

  if (isLoading) {
    return (
      <section className="mx-auto flex justify-center bg-[#F2F0F1] py-16">
        <Spinner size="md" />
      </section>
    );
  }

  if (topSelling.length === 0) return null;

  return <Carousel title="Top Selling" data={topSelling.map(toCardProps)} />;
}
