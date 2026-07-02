"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { productService } from "../../../../services/product.service";
import { categoryService } from "../../../../services/category.service";
import { adminService } from "../../../../services/staff/admin.service";
import { toast } from "../../../../components/ui/Toast";
import Input from "../../../../components/ui/Input";
import Spinner from "../../../../components/ui/Spinner";
import VariantManager from "../../../../components/staff/VariantManager";
import type { Category, Product } from "../../../../interfaces";

type Tab = "info" | "variants" | "images" | "categories";
const TABS: { key: Tab; label: string }[] = [
  { key: "info", label: "1. Info" },
  { key: "variants", label: "2. Variants & Attributes" },
  { key: "images", label: "3. Images" },
  { key: "categories", label: "4. Categories" },
];

interface ProductFormProps {
  mode: "create" | "edit";
  productId?: number;
  onSaved: (product_id: number) => void;
}

export default function ProductForm({
  mode,
  productId,
  onSaved,
}: ProductFormProps) {
  const [tab, setTab] = useState<Tab>("info");
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(mode === "edit");

  // Tab 1 — Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [savedProductId, setSavedProductId] = useState<number | null>(
    productId ?? null,
  );

  // Tab 3 — Images
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Tab 4 — Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

  useEffect(() => {
    categoryService.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (mode === "edit" && productId) {
      setLoading(true);
      productService
        .getProduct(productId)
        .then((p) => {
          setProduct(p);
          setName(p.name);
          setDescription(p.description);
          setSavedProductId(p.product_id);
          setSelectedCategoryIds(p.categories.map((c) => c.category_id));
        })
        .catch(() => toast.error("Failed to load product."))
        .finally(() => setLoading(false));
    }
  }, [mode, productId]);

  async function refreshProduct() {
    if (!savedProductId) return;
    const p = await productService.getProduct(savedProductId);
    setProduct(p);
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSavingInfo(true);
    try {
      if (savedProductId) {
        await adminService.updateProduct(savedProductId, { name, description });
        toast.success("Product updated.");
      } else {
        const { product_id } = await adminService.createProduct({
          name,
          description,
        });
        setSavedProductId(product_id);
        toast.success("Product created. Continue with variants.");
        setTab("variants");
      }
    } catch {
      toast.error("Failed to save product info.");
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleImageUpload(files: FileList) {
    if (!savedProductId) {
      toast.error("Save product info first.");
      return;
    }
    setUploadingImages(true);
    try {
      await adminService.uploadImages(savedProductId, Array.from(files));
      toast.success("Images uploaded.");
      refreshProduct();
    } catch {
      toast.error("Failed to upload images.");
    } finally {
      setUploadingImages(false);
    }
  }

  function flattenCategories(nodes: Category[]): Category[] {
    const out: Category[] = [];
    function walk(list: Category[]) {
      list.forEach((n) => {
        out.push(n);
        if (n.children?.length) walk(n.children);
      });
    }
    walk(nodes);
    return out;
  }

  const flatCategories = flattenCategories(categories);

  function toggleCategory(category_id: number) {
    setSelectedCategoryIds((prev) =>
      prev.includes(category_id)
        ? prev.filter((id) => id !== category_id)
        : [...prev, category_id],
    );
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div className="p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">
        {mode === "create" ? "New Product" : `Edit Product #${savedProductId}`}
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              if (t.key !== "info" && !savedProductId) {
                toast.error("Save product info first.");
                return;
              }
              setTab(t.key);
            }}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition",
              tab === t.key
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-800",
              t.key !== "info" &&
                !savedProductId &&
                "opacity-40 cursor-not-allowed",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1 — Info */}
      {tab === "info" && (
        <form
          onSubmit={handleSaveInfo}
          className="flex max-w-md flex-col gap-4"
        >
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            hint="Max 20 characters"
            required
          />
          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={100}
            hint="Max 100 characters"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savingInfo}
              className="rounded-lg bg-black px-6 py-2 text-sm text-white disabled:opacity-50"
            >
              {savingInfo
                ? "Saving…"
                : savedProductId
                  ? "Update Info"
                  : "Create & Continue"}
            </button>
            {savedProductId && (
              <button
                type="button"
                onClick={() => {
                  onSaved(savedProductId);
                }}
                className="text-sm text-gray-400 hover:underline"
              >
                Done
              </button>
            )}
          </div>
        </form>
      )}

      {/* Tab 2 — Variants & Attributes (VariantManager handles all of this) */}
      {tab === "variants" && savedProductId && (
        <div className="max-w-2xl">
          <p className="mb-4 text-sm text-gray-500">
            Manage variants, per-variant pricing, and attributes. Each attribute
            type can only be assigned once per variant.
          </p>
          <VariantManager
            productId={savedProductId}
            variants={product?.variants ?? []}
            onChange={refreshProduct}
          />
        </div>
      )}

      {/* Tab 3 — Images */}
      {tab === "images" && savedProductId && (
        <div className="flex flex-col gap-4 max-w-lg">
          <p className="text-sm text-gray-500">
            Max 10 files · 5 MB each · JPEG / PNG / WEBP
          </p>

          {/* Existing images */}
          {product?.images.length ? (
            <div className="flex flex-wrap gap-2">
              {product.images.map((img) => (
                <img
                  key={img.image_id}
                  src={img.s3_url}
                  alt=""
                  className="h-20 w-20 rounded-lg object-cover border"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No images yet.</p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) =>
              e.target.files && handleImageUpload(e.target.files)
            }
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImages}
            className="self-start rounded-lg border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {uploadingImages ? "Uploading…" : "Upload Images"}
          </button>
        </div>
      )}

      {/* Tab 4 — Categories */}
      {tab === "categories" && savedProductId && (
        <div className="flex flex-col gap-4 max-w-sm">
          <p className="text-sm text-gray-500">
            Select all categories this product belongs to.
          </p>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto rounded-xl border p-4">
            {flatCategories.map((c) => (
              <label
                key={c.category_id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedCategoryIds.includes(c.category_id)}
                  onChange={() => toggleCategory(c.category_id)}
                  className="rounded"
                />
                {c.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Category assignments are informational — the product_category table
            is managed via `POST /api/products/:id/categories` on the backend.
          </p>
          <button
            onClick={() => {
              onSaved(savedProductId!);
            }}
            className="self-start rounded-lg bg-black px-6 py-2 text-sm text-white hover:bg-gray-800"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
