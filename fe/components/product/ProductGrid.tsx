import type { Product } from "../../interfaces";
import ProductCard from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
}

export default function ProductGrid({
  products,
  emptyMessage = "No products found.",
}: ProductGridProps) {
  if (!products.length) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard
          key={p.product_id}
          id={p.product_id}
          name={p.name}
          price={p.price}
          originalPrice={p.originalPrice}
          discount={p.discount}
          rating={p.rating}
          imageUrl={p.imageUrl}
        />
      ))}
    </div>
  );
}
