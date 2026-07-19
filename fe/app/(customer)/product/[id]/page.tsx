"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { productService } from "../../../../services/product.service";
import { cartService } from "../../../../services/cart.service";
import { wishlistService } from "../../../../services/wishlist.service";
import { useAuthStore } from "../../../../store/useAuthStore";
import { useCartStore } from "../../../../store/useCartStore";
import { useWishlistStore } from "../../../../store/useWishlistStore";
import { toast } from "../../../../components/ui/Toast";
import Spinner from "../../../../components/ui/Spinner";
import ImageGallery from "../../../../components/product/ImageGallery";
import VariantSelector from "../../../../components/product/VariantSelector";
import PriceDisplay from "../../../../components/product/PriceDisplay";
import ReviewSection from "../../../../components/product/ReviewSection";
import { Heart } from "lucide-react";
import type { Product, ProductVariant } from "../../../../interfaces";

export default function ProductPage() {
  const params = useParams();
  const productId = Number(params.id);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { addItem: addLocalItem } = useCartStore();
  const { addItem: addWishlistItem, isWishlisted } = useWishlistStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [selected, setSelected] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [cartBusy, setCartBusy] = useState(false);
  const [wishBusy, setWishBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    productService
      .getProduct(productId)
      .then((p) => {
        setProduct(p);
        // Pre-select first in-stock variant
        const first = p.variants.find((v) => (v.stock ?? 0) > 0);
        if (first) setSelected(first);
      })
      .catch(() => toast.error("Failed to load product."))
      .finally(() => setLoading(false));
  }, [productId]);

  // Gallery shows selected variant images, falling back to product-level images
  const displayImages = selected?.images.length
    ? selected.images
    : (product?.images ?? []);

  async function handleAddToCart() {
    if (!selected) {
      toast.error("Please select a variant.");
      return;
    }
    setCartBusy(true);
    try {
      if (user) {
        await cartService.addItem({
          product_id: productId,
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
          image_url: selected.images[0]?.s3_url ?? product?.images[0]?.s3_url,
        });
      }
      toast.success("Added to cart!");
    } catch {
      toast.error("Failed to add to cart.");
    } finally {
      setCartBusy(false);
    }
  }

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
    setWishBusy(true);
    try {
      const item = await wishlistService.addToWishlist({
        product_id: productId,
        variant_id: selected.variant_id,
      });
      addWishlistItem(item);
      toast.success("Saved to wishlist!");
    } catch {
      toast.error("Failed to update wishlist.");
    } finally {
      setWishBusy(false);
    }
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
                <span className="w-8 text-center text-sm font-medium">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-10 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-100"
                >
                  +
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={cartBusy || !selected}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-40"
              >
                {cartBusy ? "Adding…" : "Add to Cart"}
              </button>

              <button
                onClick={handleWishlist}
                disabled={wishBusy}
                aria-label={wishlisted ? "Wishlisted" : "Add to wishlist"}
                className="rounded-xl border border-gray-300 px-4 py-3 text-xl hover:bg-gray-50 disabled:opacity-40"
              >
                {wishlisted ? (
                  <Heart className="bg-rose-500 text-white border-rose-500 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200" />
                ) : (
                  <Heart className="border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200" />
                )}
              </button>
            </div>

            {/* Virtual try-on — logged-in + variant selected only */}
            {user && selected && (
              <button
                onClick={() =>
                  router.push(
                    `/tryon?product_id=${productId}&variant_id=${selected.variant_id}`,
                  )
                }
                className="border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                Virtual Try-On
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
