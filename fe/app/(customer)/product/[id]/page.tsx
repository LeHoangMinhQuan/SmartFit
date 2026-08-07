"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { productService } from "../../../../services/product.service";
import { cartService } from "../../../../services/cart.service";
import { wishlistService } from "../../../../services/wishlist.service";
import { useAuthStore } from "../../../../store/useAuthStore";
import { useAuthModalStore } from "../../../../store/useAuthModalStore";
import { useCartStore } from "../../../../store/useCartStore";
import { useWishlistStore } from "../../../../store/useWishlistStore";
import { toast } from "../../../../components/ui/Toast";
import Spinner from "../../../../components/ui/Spinner";
import ImageGallery from "../../../../components/product/ImageGallery";
import VariantSelector from "../../../../components/product/VariantSelector";
import PriceDisplay from "../../../../components/product/PriceDisplay";
import ReviewSection from "../../../../components/product/ReviewSection";
import { Heart, LogIn } from "lucide-react";
import type { ProductVariant } from "../../../../interfaces";

export default function ProductPage() {
  const params = useParams();
  const productId = Number(params.id);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const { addItem: addLocalItem, setCartData } = useCartStore();
  const { addItem: addWishlistItem, isWishlisted } = useWishlistStore();

  const [selected, setSelected] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => productService.getProduct(productId),
  });
  const product = productQuery.data ?? null;
  const loading = productQuery.isLoading;

  // Pre-select first in-stock variant once the product loads.
  useEffect(() => {
    if (!product) return;
    const first = product.variants.find((v) => (v.stock ?? 0) > 0);
    if (first) setSelected(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.product_id]);

  useEffect(() => {
    if (productQuery.isError) toast.error("Failed to load product.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productQuery.isError]);

  // Gallery shows selected variant images, falling back to product-level images.
  // Both selected.images and product.images can come back missing/undefined
  // (e.g. locally where the upload middleware isn't wired up yet, so no
  // product_image rows exist) — default to [] rather than crashing on
  // `.length` of undefined.
  const selectedImages = selected?.images ?? [];
  const productImages = product?.images ?? [];
  const displayImages = selectedImages.length ? selectedImages : productImages;

  const addToCartMutation = useMutation({
    mutationFn: (vars: { variant_id: number; quantity: number }) =>
      cartService.addItem({
        product_id: productId,
        variant_id: vars.variant_id,
        quantity: vars.quantity,
      }),
    onSuccess: (cart) => {
      // cartService.addItem returns the full, authoritative cart — feed
      // it straight into the store so Header's badge (which reads
      // useCartStore, not the server) updates immediately.
      setCartData(cart.items, cart.total);
      toast.success("Added to cart!");
    },
    onError: () => toast.error("Failed to add to cart."),
  });
  const cartBusy = addToCartMutation.isPending;

  async function handleAddToCart() {
    if (!selected) {
      toast.error("Please select a variant.");
      return;
    }
    if (user) {
      addToCartMutation.mutate({
        variant_id: selected.variant_id,
        quantity,
      });
    } else {
      // Guest — local store; merges with server on login
      addLocalItem({
        product_id: productId,
        variant_id: selected.variant_id,
        quantity,
        // unit_price and subtotal are server-computed on merge;
        // these local values are display-only until then
        unit_price: selected.base_price,
        subtotal: selected.base_price * quantity,
        user_id: 0,
        cart_id: 0,
        product_name: product?.name,
        variant_name: selected.name,
        image_url: selected.images?.[0]?.s3_url ?? product?.images?.[0]?.s3_url,
      });
      toast.success("Added to cart!");
    }
  }

  const addWishlistMutation = useMutation({
    mutationFn: (vars: { variant_id: number }) =>
      wishlistService.addToWishlist({
        product_id: productId,
        variant_id: vars.variant_id,
      }),
    onSuccess: (_data, vars) => {
      addWishlistItem({
        product_id: productId,
        variant_id: vars.variant_id,
        created_at: new Date().toISOString(),
        product_name: product?.name,
        variant_name: selected?.name,
        base_price: String(selected?.base_price),
        image_url: displayImages[0]?.s3_url ?? null,
      });
      toast.success("Saved to wishlist!");
    },
    onError: () => toast.error("Failed to update wishlist."),
  });
  const wishBusy = addWishlistMutation.isPending;

  async function handleWishlist() {
    if (!user) {
      toast.info("Sign in to save items.");
      return;
    }
    if (!selected) {
      toast.error("Select a variant first.");
      return;
    }
    if (isWishlisted(productId, selected.variant_id)) {
      toast.info("Already in your wishlist.");
      return;
    }
    addWishlistMutation.mutate({ variant_id: selected.variant_id });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-24 text-center text-gray-500">Product not found.</div>
    );
  }

  const wishlisted = selected
    ? isWishlisted(productId, selected.variant_id)
    : false;

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-7xl px-6 py-10 rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          {/* Left — gallery */}
          <ImageGallery images={displayImages} />

          {/* Right — details */}
          <div className="flex flex-col gap-5">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {product.name}
            </h1>
            <p className="text-base leading-7 text-slate-600">
              {product.description}
            </p>

            {!user && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                <span>
                  Sign in to save items, checkout faster, and try this on
                  virtually.
                </span>
                <button
                  onClick={openLogin}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white transition hover:bg-indigo-700"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </button>
              </div>
            )}

            {selected && (
              <PriceDisplay
                basePrice={selected.base_price}
                discount={selected.discount}
              />
            )}

            <VariantSelector
              variants={product.variants}
              selectedId={selected?.variant_id ?? null}
              onSelect={(v) => {
                setSelected(v);
                setQuantity(1);
              }}
            />

            {/* Quantity stepper */}
            {/* BUG FIX: the "+" button previously had no upper bound at
                all -- not even tied to selected.stock -- so a customer
                could click past what's actually available and the item
                would silently go into the cart anyway (cart.service.ts
                didn't check stock at add-time either -- see that file's
                fix). Both the visual cap and the disabled state below
                are enforced client-side for immediate feedback; the real
                guarantee is still cart.service.ts's server-side check. */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                Quantity
              </span>
              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-100"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm text-slate-900 font-medium">
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity((q) =>
                      selected?.stock ? Math.min(selected.stock, q + 1) : q + 1,
                    )
                  }
                  disabled={!!selected?.stock && quantity >= selected.stock}
                  className="flex h-10 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  +
                </button>
              </div>
              {!!selected?.stock && quantity >= selected.stock && (
                <span className="text-xs text-slate-500">
                  Only {selected.stock} in stock
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={cartBusy || !selected}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:pointer-events-none disabled:opacity-40"
              >
                {cartBusy ? "Adding…" : "Add to Cart"}
              </button>

              <button
                onClick={handleWishlist}
                disabled={wishBusy}
                aria-label={
                  wishlisted ? "Remove from wishlist" : "Add to wishlist"
                }
                className={`flex items-center justify-center rounded-xl border px-4 py-3 transition-all duration-200 disabled:opacity-40 ${
                  wishlisted
                    ? "border-rose-200 bg-rose-50 text-rose-500 hover:border-rose-300 hover:bg-rose-100"
                    : "border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                }`}
              >
                <Heart
                  className={`h-6 w-6 transition-transform duration-200 active:scale-90 ${
                    wishlisted
                      ? "fill-rose-500 text-rose-500"
                      : "fill-transparent"
                  }`}
                />
              </button>
            </div>

            {/* Virtual try-on — needs a variant selected either way */}
            {selected && (
              <button
                onClick={() =>
                  user
                    ? router.push(
                        `/tryon?product_id=${productId}&variant_id=${selected.variant_id}`,
                      )
                    : openLogin()
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                {user ? (
                  "Virtual Try-On"
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign In to Try It On
                  </>
                )}
              </button>
            )}

            {/* Attributes */}
            {selected?.attributes.length ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                {selected.attributes.map((a) => (
                  <div
                    key={a.attribute_id}
                    className="flex justify-between border-b border-slate-200 py-2 last:border-0"
                  >
                    <span className="font-medium capitalize">
                      {a.attribute_name}:
                    </span>
                    <span>{a.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-16 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <ReviewSection
            product_id={productId}
            variant_id={selected?.variant_id ?? null}
          />
        </div>
      </div>
    </div>
  );
}
