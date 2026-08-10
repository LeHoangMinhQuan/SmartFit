import { categoryService } from "@/services/category.service";
import ProductGrid from "@/components/product/ProductGrid";
import ProductFilters from "@/components/product/ProductFilters";
import Pagination from "@/components/ui/Pagination";
import type { Category } from "@/interfaces";
import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { LayoutGrid, PackageX } from "lucide-react";

interface Props {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    page?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }>;
}

function flattenCategories(nodes: Category[]): Category[] {
  const result: Category[] = [];
  function walk(list: Category[]) {
    for (const n of list) {
      result.push(n);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

// React's cache() dedupes this within a single request — generateMetadata
// and the page component below both need the category list, and without
// this they'd each fire their own GET /categories against the backend.
const getCategoriesCached = cache(() => categoryService.getCategories());

async function resolveCategory(
  slug: string,
): Promise<{ id: number; name: string } | null> {
  const categories: Category[] = await getCategoriesCached();
  const flat = flattenCategories(categories);
  const decoded = decodeURIComponent(slug);

  // Normalize hyphens to spaces to handle URL-friendly slugs
  const normalized = decoded.replace(/-/g, " ");

  const match =
    flat.find((c) => c.name === decoded) ??
    flat.find((c) => c.name.toLowerCase() === decoded.toLowerCase()) ??
    flat.find((c) => c.name.toLowerCase() === normalized.toLowerCase());

  return match ? { id: match.category_id, name: match.name } : null;
}

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const category = await resolveCategory(slug);

  if (!category) {
    // Let the page component's own not-found UI render — this metadata
    // just keeps a dead link from being indexed under a misleading title.
    return { title: "Category not found", robots: { index: false } };
  }

  return {
    title: category.name,
    description: `Shop ${category.name.toLowerCase()} at SMARTFIT — browse the full collection with new arrivals, top sellers, and virtual try-on.`,
    alternates: { canonical: `/category/${encodeURIComponent(category.name)}` },
    openGraph: {
      title: `${category.name} | SMARTFIT`,
      description: `Shop ${category.name.toLowerCase()} at SMARTFIT.`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;

  const category = await resolveCategory(slug);

  if (!category) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 shadow-sm">
          <PackageX className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          Category not found
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          The category you are looking for doesn't exist or has been removed.
        </p>
      </div>
    );
  }

  const page = Number(query.page ?? 1);
  const result = await categoryService.getCategoryProducts(category.id, {
    page,
    limit: 20,
    minPrice: query.minPrice ? Number(query.minPrice) : undefined,
    maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
    sort: query.sort,
  });

  return (
    <div className="mx-auto bg-gray-200 max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Modernized Header Card */}
      <div className="mb-10 flex items-center gap-5 rounded-3xl bg-slate-50 p-6 border border-slate-100 shadow-sm">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
          <LayoutGrid className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {category.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Explore our collection of {category.name.toLowerCase()} products
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Responsive Filters Column */}
        <Suspense
          fallback={
            <div className="w-full lg:w-64 shrink-0 h-96 animate-pulse rounded-2xl bg-slate-100" />
          }
        >
          <div className="w-full shrink-0 lg:w-64 lg:sticky lg:top-24">
            <ProductFilters />
          </div>
        </Suspense>

        {/* Products Grid Column */}
        <div className="flex flex-1 flex-col gap-8">
          {result.data.length > 0 ? (
            <>
              <ProductGrid products={result.data} />
              <div className="mt-6 flex justify-center">
                <Pagination meta={result.meta} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-24 text-center">
              <PackageX className="mb-3 h-10 w-10 text-slate-400" />
              <p className="text-base font-medium text-slate-900">
                No products found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try adjusting your filters or price range to see more results.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
