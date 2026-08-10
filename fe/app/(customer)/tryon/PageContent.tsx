"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { productService } from "../../../services/product.service";
import { tryonService } from "../../../services/tryon.service";
import { useAuthStore } from "../../../store/useAuthStore";
import { useTryOnTrackerStore } from "../../../store/useTryOnTrackerStore";
import { toast } from "../../../components/ui/Toast";
import Spinner from "../../../components/ui/Spinner";
import PhotoUpload from "../../../components/tryon/PhotoUpload";
import TryOnResult from "../../../components/tryon/TryOnResult";
import type { ClothType } from "../../../interfaces";

type Stage = "upload" | "result";

interface Props {
  productId: number;
  variantId: number;
  // Present when navigated here from a TryOnTracker card ("tap to
  // view") — jumps straight to the result stage for that session
  // instead of making the user re-upload a photo.
  sessionId?: number;
}

const CLOTH_TYPE_OPTIONS: { value: ClothType; label: string }[] = [
  { value: "upper", label: "Top" },
  { value: "lower", label: "Bottom" },
  { value: "overall", label: "Dress" },
];

export default function TryOnPage({
  productId,
  variantId,
  sessionId: deepLinkedSessionId,
}: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const track = useTryOnTrackerStore((s) => s.track);
  const untrack = useTryOnTrackerStore((s) => s.untrack);

  const [stage, setStage] = useState<Stage>(
    deepLinkedSessionId ? "result" : "upload",
  );
  const [sessionId, setSessionId] = useState<number | null>(
    deepLinkedSessionId ?? null,
  );
  const [clothType, setClothType] = useState<ClothType>("upper");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
  const garmentImage =
    variant?.images?.[0]?.s3_url ?? product?.images?.[0]?.s3_url;

  useEffect(() => {
    if (productQuery.isError) toast.error("Failed to load product.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productQuery.isError]);

  const submitPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      const { session_id } = await tryonService.uploadPhoto(
        file,
        productId,
        variantId,
      );
      await tryonService.requestPreview({
        session_id,
        cloth_type: clothType,
      });
      return session_id;
    },
    onSuccess: (session_id) => {
      setSessionId(session_id);
      setStage("result");
      track({
        session_id,
        product_id: productId,
        variant_id: variantId,
        product_name: product?.name,
        variant_name: variant?.name,
        thumbnail_url: garmentImage ?? null,
      });
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
    setSelectedFile(file);
  }

  function handleClearPhoto() {
    setSelectedFile(null);
  }

  function handleConfirm() {
    if (!selectedFile) return;
    submitPhotoMutation.mutate(selectedFile);
  }

  function handleReset() {
    if (sessionId) untrack(sessionId);
    setSessionId(null);
    setSelectedFile(null);
    setStage("upload");
  }

  if (!user) return null;

  if (!productId || !variantId) {
    return (
      <div className="min-h-screen bg-slate-50 py-24 text-center text-slate-500">
        Missing product or variant. Go back to a product page and tap{" "}
        <span className="font-medium text-slate-900">Virtual Try-On</span>.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-5xl px-6 py-10 rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
        {/* Header Section */}
        <div className="mb-10 border-b border-slate-100 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Virtual Try-On
          </h1>
          {product && (
            <p className="mt-3 text-base leading-7 text-slate-600">
              {product.name} <span className="mx-2 text-slate-300">|</span>{" "}
              <span className="font-medium text-slate-800">
                {variant?.name}
              </span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          {/* Left Column — Garment Reference */}
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Garment Reference
            </h2>
            {garmentImage ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                <img
                  src={garmentImage}
                  alt={product?.name ?? "Garment"}
                  className="aspect-square w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
                No image available
              </div>
            )}
          </div>

          {/* Right Column — Upload & Controls */}
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-semibold text-slate-900">
              {stage === "upload" ? "Your Photo & Settings" : "Try-On Result"}
            </h2>

            {stage === "upload" ? (
              <div className="flex flex-col gap-6">
                {/* Garment Type Selector */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="mb-3 text-sm font-medium text-slate-700">
                    Select Garment Type
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {CLOTH_TYPE_OPTIONS.map((opt) => {
                      const isSelected = clothType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={submitting}
                          onClick={() => setClothType(opt.value)}
                          className={`rounded-xl border px-5 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-600 text-white shadow-md"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Photo Upload Area */}
                <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
                  <PhotoUpload
                    onFile={handlePhoto}
                    onClear={handleClearPhoto}
                    disabled={submitting}
                  />
                </div>

                {/* Action Button */}
                <div className="mt-2 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!selectedFile || submitting}
                    className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <Spinner size="sm" className="text-white" />
                        Generating Magic...
                      </span>
                    ) : (
                      "Confirm & Generate"
                    )}
                  </button>

                  {submitting && (
                    <p className="text-center text-xs font-medium text-slate-500 animate-pulse">
                      Please wait, analyzing image and rendering garment...
                    </p>
                  )}
                </div>
              </div>
            ) : (
              sessionId && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <TryOnResult sessionId={sessionId} onReset={handleReset} />
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
