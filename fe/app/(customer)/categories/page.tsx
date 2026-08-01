"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { categoryService } from "@/services/category.service";
import Spinner from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toast";
import type { Category } from "@/interfaces";

// "All" and "Brands" are nav-only pseudo-categories seeded purely to back
// the Header's quick links (see be's seeds/06_demo_products.ts comment) —
// not real merchandising categories, so they're excluded here to avoid a
// redundant/confusing tile on a page whose whole point is "browse real
// categories".
const NAV_ONLY_CATEGORIES = new Set(["all", "brands"]);

function categoryHref(name: string): string {
  return `/category/${encodeURIComponent(name)}`;
}

export default function CategoriesPage() {
  const {
    data: categories = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["categories", "all-tree"],
    queryFn: () => categoryService.getCategories(),
  });

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load categories.");
      console.error(error);
    }
  }, [isError, error]);

  const browsable = categories.filter(
    (c) => !NAV_ONLY_CATEGORIES.has(c.name.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h1 className="mb-2 text-3xl font-black uppercase tracking-tight text-black sm:text-4xl">
          Shop by Category
        </h1>
        <p className="mb-10 text-sm text-gray-500">
          Pick a category to see everything in it.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Spinner size="lg" />
          </div>
        ) : browsable.length === 0 ? (
          <p className="py-24 text-center text-sm text-gray-500">
            No categories available yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {browsable.map((category) => (
              <div
                key={category.category_id}
                className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <Link
                  href={categoryHref(category.name)}
                  className="group relative block h-40 w-full overflow-hidden bg-[#F0EEED]"
                >
                  {category.image_url && (
                    <Image
                      src={category.image_url}
                      alt={category.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover object-center transition-transform group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <h2 className="absolute bottom-4 left-5 text-xl font-bold text-white">
                    {category.name}
                  </h2>
                </Link>

                {category.children && category.children.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-4">
                    {category.children.map((child) => (
                      <Link
                        key={child.category_id}
                        href={categoryHref(child.name)}
                        className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-black hover:text-black"
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
