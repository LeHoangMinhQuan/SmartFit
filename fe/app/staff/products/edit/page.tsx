"use client";

import { useRouter } from "next/navigation";
import ProductForm from "../_components/ProductForm";

export default function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  return (
    <ProductForm
      mode="edit"
      productId={Number(params.id)}
      onSaved={() => router.push("/staff/products")}
    />
  );
}
