"use client";

import { useRouter, useParams } from "next/navigation";
import ProductForm from "../_components/ProductForm";

export default function EditProductPage({}) {
  const params = useParams();
  const productId = Number(params.id);
  const router = useRouter();
  return (
    <ProductForm
      mode="edit"
      productId={productId}
      onSaved={() => router.push("/staff/products")}
    />
  );
}
