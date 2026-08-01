"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { categoryService } from "@/services/category.service";
import Spinner from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toast";

export default function FeaturedCategoriesSection() {
  const {
    data: featuredCategories = [],
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ["categories", "featured"],
    queryFn: () => categoryService.getFeaturedCategories(),
  });

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load categories.");
      console.error(error);
    }
  }, [isError]);

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <div className="bg-[#F0F0F0] rounded-[40px] p-8 md:p-16">
        <h2 className="text-3xl text-black md:text-5xl font-black text-center uppercase mb-12">
          Browse By Category
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        ) : featuredCategories.length ===
          0 ? // No categories marked featured yet (or failed to load) — render
        // rather than showing broken/placeholder tiles.
        null : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 h-auto md:h-[600px]">
            {featuredCategories.map((category, i) => (
              <Link
                key={category.category_id}
                href={`/category/${encodeURIComponent(category.name)}`}
                className={`relative bg-white rounded-3xl overflow-hidden group cursor-pointer ${
                  i % 3 === 2
                    ? "col-span-1 md:col-span-8"
                    : "col-span-1 md:col-span-4"
                }`}
              >
                <div className="absolute top-6 left-8 z-10">
                  <h3 className="text-2xl text-black font-bold">
                    {category.name}
                  </h3>
                </div>
                {category.image_url && (
                  <Image
                    src={category.image_url}
                    alt={category.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover object-right-top transition-transform group-hover:scale-105"
                  />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
