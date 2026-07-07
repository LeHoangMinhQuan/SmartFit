"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { productService } from "../../../services/product.service";
import { tryonService } from "../../../services/tryon.service";
import { useAuthStore } from "../../../store/useAuthStore";
import { toast } from "../../../components/ui/Toast";
import Spinner from "../../../components/ui/Spinner";
import PhotoUpload from "../../../components/tryon/PhotoUpload";
import TryOnResult from "../../../components/tryon/TryOnResult";
import type { Product, ProductVariant } from "../../../interfaces";

type Stage = "upload" | "result";

interface Props {
  productId: number;
  variantId: number;
}


export default function TryOnPage({ productId, variantId }: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [product, setProduct] = useState<Product | null>(null);
  const [variant, setVariant] = useState<ProductVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("upload");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (!productId || !variantId) {
      setLoading(false);
      return;
    }
    productService
      .getProduct(productId)
      .then((p) => {
        setProduct(p);
        const v = p.variants.find((v) => v.variant_id === variantId);
        setVariant(v ?? null);
      })
      .catch(() => toast.error("Failed to load product."))
      .finally(() => setLoading(false));
  }, [productId, variantId]);

  async function handlePhoto(file: File) {
    setSubmitting(true);
    try {
      const { session_id } = await tryonService.uploadPhoto(file);
      await tryonService.requestPreview({
        session_id,
        product_id: productId,
        variant_id: variantId,
      });
      setSessionId(session_id);
      setStage("result");
    } catch (e: unknown) {
      if ((e as { response?: { status?: number } })?.response?.status === 429) {
        toast.error("Rate limit reached. Please wait before trying again.");
      } else {
        toast.error("Failed to start try-on. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setSessionId(null);
    setStage("upload");
  }

  if (!user) return null;

  if (!productId || !variantId) {
    return (
      <div className="py-24 text-center text-gray-500">
        Missing product or variant. Go back to a product page and tap{" "}
        <span className="font-medium">Virtual Try-On</span>.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  const garmentImage = variant?.images[0]?.s3_url ?? product?.images[0]?.s3_url;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Virtual Try-On</h1>
      {product && (
        <p className="mb-8 text-sm text-gray-500">
          {product.name} — {variant?.name}
        </p>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        {/* Garment reference */}
        {garmentImage && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Garment</p>
            <img
              src={garmentImage}
              alt={product?.name ?? "Garment"}
              className="aspect-square w-full rounded-xl bg-gray-50 object-cover"
            />
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            {stage === "upload" ? "Your Photo" : "Result"}
          </p>

          {stage === "upload" ? (
            <PhotoUpload onFile={handlePhoto} disabled={submitting} />
          ) : (
            sessionId && (
              <TryOnResult sessionId={sessionId} onReset={handleReset} />
            )
          )}
        </div>
      </div>

      {submitting && (
        <p className="mt-4 text-center text-sm text-gray-500">
          Uploading and starting generation…
        </p>
      )}
    </div>
  );
}
