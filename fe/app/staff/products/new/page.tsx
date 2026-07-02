"use client";

import { useRouter } from "next/navigation";
import ProductForm from "../_components/ProductForm";

export default function NewProductPage() {
  const router = useRouter();
  return (
    <ProductForm
      mode="create"
      onSaved={(product_id) => router.push(`/staff/products/${product_id}`)}
    />
  );
}
