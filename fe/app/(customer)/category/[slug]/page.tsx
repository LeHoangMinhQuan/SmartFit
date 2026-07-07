import { categoryService } from "@/services/category.service";
import ProductGrid from "@/components/product/ProductGrid";
import ProductFilters from "@/components/product/ProductFilters";
import Pagination from "@/components/ui/Pagination";
import type { Category } from "@/interfaces";
import { Suspense } from "react";

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

async function resolveCategoryId(slug: string): Promise<number | null> {
  // TODO: add categories for UI test
  // const categories: Category[] = await categoryService.getCategories();
  const categories = [
    { category_id: 1, name: "TestCategory", parent_id: null, children: [] },
  ];
  const flat = flattenCategories(categories);
  const decoded = decodeURIComponent(slug);
  const match =
    flat.find((c) => c.name === decoded) ??
    flat.find((c) => c.name.toLowerCase() === decoded.toLowerCase());
  return match?.category_id ?? null;
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;

  const category_id = await resolveCategoryId(slug);

  if (!category_id) {
    return (
      <div className="py-24 text-center text-gray-500">Category not found.</div>
    );
  }

  const page = Number(query.page ?? 1);
  // TODO: use sample data for UI test
  // const result = await categoryService.getCategoryProducts(category_id, {
  //   page,
  //   limit: 20,
  //   minPrice: query.minPrice ? Number(query.minPrice) : undefined,
  //   maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
  //   sort: query.sort,
  // });
  const result = {
    data: [
      {
        product_id: 1,
        name: "Test Product",
        description: "This is a test product description.",
        image: null,
        price: 19.99,
        originalPrice: undefined,
        discountActive: false,
        avg_rating: null, 
      },
    ],
    meta: {
      page: 1,
      limit: 20,
      total: 21,
      totalPages: 2,
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold">{decodeURIComponent(slug)}</h1>

      <div className="flex gap-8">
        <Suspense fallback={<div className="w-52 shrink-0" />}>
          <ProductFilters />
        </Suspense>

        <div className="flex flex-1 flex-col gap-6">
          <ProductGrid products={result.data} />
          <Pagination meta={result.meta} />
        </div>
      </div>
    </div>
  );
}