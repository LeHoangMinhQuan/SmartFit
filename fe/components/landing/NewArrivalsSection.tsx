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
    rating: p.avg_rating ?? 0,
    imageUrl: p.image ?? undefined,
  };
}

export default function NewArrivalsSection() {
  const {
    data: newArrivals = [],
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ["products", "new-arrivals", 8],
    queryFn: () => productService.getNewArrivals(8),
  });

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load new arrivals.");
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

  if (newArrivals.length === 0) return null;

  return <Carousel title="New Arrivals" data={newArrivals.map(toCardProps)} />;
}
