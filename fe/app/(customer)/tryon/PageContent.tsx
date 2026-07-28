"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { productService } from "../../../services/product.service";
import { tryonService } from "../../../services/tryon.service";
import { useAuthStore } from "../../../store/useAuthStore";
import { toast } from "../../../components/ui/Toast";
import Spinner from "../../../components/ui/Spinner";
import PhotoUpload from "../../../components/tryon/PhotoUpload";
import TryOnResult from "../../../components/tryon/TryOnResult";
import type { ClothType } from "../../../interfaces";

type Stage = "upload" | "result";

interface Props {
  productId: number;
  variantId: number;
}

const CLOTH_TYPE_OPTIONS: { value: ClothType; label: string }[] = [
  { value: "upper", label: "Top" },
  { value: "lower", label: "Bottom" },
  { value: "overall", label: "Dress" },
];

export default function TryOnPage({ productId, variantId }: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [stage, setStage] = useState<Stage>("upload");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [clothType, setClothType] = useState<ClothType>("upper");

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) router.replace("/");
  }, [hasHydrated, user, router]);

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => productService.getProduct(productId),
    enabled: !!productId && !!variantId,
  });
  const product = productQuery.data ?? null;
  const variant =
    product?.variants.find((v) => v.variant_id === variantId) ?? null;
  const loading = !productId || !variantId ? false : productQuery.isLoading;

  useEffect(() => {
    if (productQuery.isError) toast.error("Failed to load product.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productQuery.isError]);

  const submitPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      // product_id/variant_id pin the session at upload time — they are
      // required by the backend here, not at preview time (see
      // tryon.service.ts).
      const { session_id } = await tryonService.uploadPhoto(
        file,
        productId,
        variantId,
      );
      // Only session_id + cloth_type go to /preview; product_id/variant_id
      // are already pinned to the session.
      await tryonService.requestPreview({
        session_id,
        cloth_type: clothType,
      });
      return session_id;
    },
    onSuccess: (session_id) => {
      setSessionId(session_id);
      setStage("result");
    },
    onError: (e: unknown) => {
      if ((e as { response?: { status?: number } })?.response?.status === 429) {
        toast.error("Rate limit reached. Please wait before trying again.");
      } else {
        toast.error("Failed to start try-on. Please try again.");
      }
    },
  });
  const submitting = submitPhotoMutation.isPending;

  async function handlePhoto(file: File) {
    submitPhotoMutation.mutate(file);
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

  const garmentImage =
    variant?.images?.[0]?.s3_url ?? product?.images?.[0]?.s3_url;

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
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">
                  Garment type
                </p>
                <div className="flex gap-2">
                  {CLOTH_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={submitting}
                      onClick={() => setClothType(opt.value)}
                      className={
                        "rounded-full border px-4 py-1.5 text-sm transition disabled:opacity-50 " +
                        (clothType === opt.value
                          ? "border-black bg-black text-white"
                          : "border-gray-300 text-gray-600 hover:border-gray-500")
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <PhotoUpload onFile={handlePhoto} disabled={submitting} />
            </div>
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
