import { Suspense } from "react";
import Link from "next/link";
import { productService } from "@/services/product.service";
import ProductGrid from "@/components/product/ProductGrid";
import Pagination from "@/components/ui/Pagination";
import { Search } from "lucide-react";

interface Props {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const page = Number(query.page ?? 1);

  if (!q) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#F0EEED]">
          <Search className="h-7 w-7 text-gray-400" />
        </div>
        <h1 className="text-xl font-semibold text-black">
          Search for something to wear
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
          Try a product name, category, or brand — start typing in the search
          bar above and we&apos;ll show matching products as you type.
        </p>
        <Link
          href="/category/all"
          className="mt-6 inline-block rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Browse All Products
        </Link>
      </div>
    );
  }

  const result = await productService.searchProducts(q, { page, limit: 20 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-black">
        Results for &ldquo;{q}&rdquo;
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        {result.meta.total} product{result.meta.total === 1 ? "" : "s"} found
      </p>

      <Suspense fallback={null}>
        <ProductGrid
          products={result.data}
          emptyMessage={`No products matched "${q}". Try a different search term or browse by category instead.`}
        />
      </Suspense>

      {result.data.length === 0 && (
        <div className="mt-6 flex justify-center">
          <Link
            href="/category/all"
            className="rounded-full border border-gray-300 px-6 py-3 text-sm font-medium text-black transition hover:bg-gray-50"
          >
            Browse All Products
          </Link>
        </div>
      )}

      <div className="mt-8">
        <Pagination meta={result.meta} />
      </div>
    </div>
  );
}
