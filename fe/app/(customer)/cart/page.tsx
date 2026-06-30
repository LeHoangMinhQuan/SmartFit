import { productService } from "../../../services/product.service";
import ProductGrid from "../../../components/product/ProductGrid";
import Pagination from "../../../components/ui/Pagination";

interface Props {
  searchParams: { q?: string; page?: string };
}

export default async function SearchPage({ searchParams }: Props) {
  const q = searchParams.q?.trim() ?? "";
  const page = Number(searchParams.page ?? 1);

  if (!q) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center text-gray-500">
        Enter a search term to find products.
      </div>
    );
  }

  const result = await productService.searchProducts(q, { page, limit: 20 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Results for &ldquo;{q}&rdquo;</h1>
      <p className="mb-8 text-sm text-gray-500">
        {result.meta.total} product(s) found
      </p>

      <ProductGrid
        products={result.data}
        emptyMessage={`No products matched "${q}".`}
      />
      <div className="mt-8">
        <Pagination meta={result.meta} />
      </div>
    </div>
  );
}
