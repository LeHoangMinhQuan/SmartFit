"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { productService } from "../../../../services/product.service";
import { categoryService } from "../../../../services/category.service";
import { adminService } from "../../../../services/staff/admin.service";
import { toast } from "../../../../components/ui/Toast";
import Input from "../../../../components/ui/Input";
import Spinner from "../../../../components/ui/Spinner";
import VariantManager from "../../../../components/staff/VariantManager";
import { Category } from "@/interfaces";

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
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("info");
  const [savedProductId, setSavedProductId] = useState<number | null>(
    productId ?? null,
  );

  const productQuery = useQuery({
    queryKey: ["staff-product", savedProductId],
    queryFn: () => productService.getProduct(savedProductId!),
    // Enable it as soon as there's a saved id, in either mode.
    enabled: savedProductId != null,
  });
  const product = productQuery.data ?? null;

  const categoriesQuery = useQuery({
    queryKey: ["staff-categories"],
    queryFn: () => categoryService.getCategories(),
    staleTime: 5 * 60_000,
  });
  const categories = categoriesQuery.data ?? [];

  // Tab 1 — Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  // Used for real GHN shipping fee/service calculation (see
  // services/ghn.service.ts#getParcelForItems on the backend) instead of
  // a hardcoded placeholder parcel. Kept as strings so the input can be
  // empty ("not set yet") rather than forced to 0.
  const [weightGrams, setWeightGrams] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");

  // Tab 3 — Images
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageVariantId, setImageVariantId] = useState<string>(""); // "" = general
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

  // Tab 4 — Categories
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [savingCategories, setSavingCategories] = useState(false);

  // Sync local form state whenever the fetched product changes
  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description);
      setWeightGrams(product.weight_grams?.toString() ?? "");
      setLengthCm(product.length_cm?.toString() ?? "");
      setWidthCm(product.width_cm?.toString() ?? "");
      setHeightCm(product.height_cm?.toString() ?? "");
      setSelectedCategoryIds(
        (product.categories ?? []).map((c) => c.category_id),
      );
    }
  }, [product]);

  // NEW: React to the state update here
  useEffect(() => {
    if (savedProductId !== null) {
      console.log(
        "State successfully updated! savedProductId is now:",
        savedProductId,
      );
    }
  }, [savedProductId]);

  function invalidateProduct() {
    if (savedProductId != null) {
      queryClient.invalidateQueries({
        queryKey: ["staff-product", savedProductId],
      });
    }
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSavingInfo(true);
    try {
      const dims = {
        weight_grams: weightGrams ? Number(weightGrams) : undefined,
        length_cm: lengthCm ? Number(lengthCm) : undefined,
        width_cm: widthCm ? Number(widthCm) : undefined,
        height_cm: heightCm ? Number(heightCm) : undefined,
      };
      if (savedProductId) {
        await adminService.updateProduct(savedProductId, {
          name,
          description,
          ...dims,
        });
        toast.success("Product updated.");
        invalidateProduct();
      } else {
        const { product_id } = await adminService.createProduct({
          name,
          description,
          ...dims,
        });

        // Update the state (React handles this asynchronously)
        setSavedProductId(product_id);

        toast.success("Product created. Continue with variants.");
        setTab("variants");
      }
      queryClient.invalidateQueries({ queryKey: ["staff-products"] });
    } catch {
      toast.error("Failed to save product info.");
    } finally {
      setSavingInfo(false);
    }
  }
  // Generate/revoke object URLs whenever the pending file list changes —
  // object URLs must be explicitly revoked or they leak memory.
  useEffect(() => {
    const urls = pendingFiles.map((f) => URL.createObjectURL(f));
    setPendingPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingFiles]);

  function handleFilesSelected(files: FileList) {
    const incoming = Array.from(files);
    const MAX_FILES = 10;
    const MAX_SIZE = 5 * 1024 * 1024;

    const tooBig = incoming.filter((f) => f.size > MAX_SIZE);
    if (tooBig.length) {
      toast.error(`${tooBig.length} file(s) exceed 5 MB and were skipped.`);
    }
    const validNew = incoming.filter((f) => f.size <= MAX_SIZE);

    setPendingFiles((prev) => {
      const combined = [...prev, ...validNew];
      if (combined.length > MAX_FILES) {
        toast.error(`Max ${MAX_FILES} images — extra files were skipped.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });

    // Reset the input so selecting the same file again re-triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function clearPendingFiles() {
    setPendingFiles([]);
  }

  async function handleImageUpload() {
    if (!savedProductId || pendingFiles.length === 0) return;
    setUploadingImages(true);
    try {
      const variantId = imageVariantId ? Number(imageVariantId) : undefined;
      await adminService.uploadImages(savedProductId, pendingFiles, variantId);
      toast.success(
        `${pendingFiles.length} image${pendingFiles.length > 1 ? "s" : ""} uploaded.`,
      );
      clearPendingFiles();
      invalidateProduct();
    } catch {
      toast.error("Failed to upload images.");
    } finally {
      setUploadingImages(false);
    }
  }

  function toggleCategory(category_id: number) {
    setSelectedCategoryIds((prev) =>
      prev.includes(category_id)
        ? prev.filter((id) => id !== category_id)
        : [...prev, category_id],
    );
  }

  async function handleSaveCategories() {
    if (!savedProductId) return;
    setSavingCategories(true);
    try {
      await adminService.setCategories(savedProductId, selectedCategoryIds);
      toast.success("Categories saved.");
      invalidateProduct();
      onSaved(savedProductId);
    } catch {
      toast.error("Failed to save categories.");
    } finally {
      setSavingCategories(false);
    }
  }

  const loading = mode === "edit" && productQuery.isLoading;

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {mode === "create"
            ? "New Product"
            : `Edit Product #${savedProductId}`}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "create"
            ? "Set up a new product, then add variants, images, and categories."
            : "Update product info, variants, images, and categories."}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
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
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition hover:cursor-pointer",
              tab === t.key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800",
              t.key !== "info" &&
                !savedProductId &&
                "opacity-40 cursor-not-allowed hover:cursor-not-allowed",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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

            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">
                Shipping dimensions
              </p>
              <p className="mb-2 text-xs text-slate-400">
                Used to calculate real shipping fees. Leave blank to use a
                default placeholder parcel.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Weight (g)"
                  type="number"
                  min={1}
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                />
                <Input
                  label="Length (cm)"
                  type="number"
                  min={1}
                  value={lengthCm}
                  onChange={(e) => setLengthCm(e.target.value)}
                />
                <Input
                  label="Width (cm)"
                  type="number"
                  min={1}
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                />
                <Input
                  label="Height (cm)"
                  type="number"
                  min={1}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingInfo}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:cursor-pointer hover:shadow-xl active:translate-y-0 active:shadow-lg disabled:pointer-events-none disabled:opacity-50"
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
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:cursor-pointer hover:bg-slate-100 active:bg-slate-200"
                >
                  Done
                </button>
              )}
            </div>
          </form>
        )}

        {/* Tab 2 — Variants & Attributes */}
        {tab === "variants" && savedProductId && (
          <div className="max-w-2xl">
            <p className="mb-4 text-sm text-slate-500">
              Manage variants, per-variant pricing, and attributes. Each
              attribute type can only be assigned once per variant.
            </p>
            <VariantManager
              productId={savedProductId}
              variants={product?.variants ?? []}
              onChange={invalidateProduct}
            />
          </div>
        )}

        {/* Tab 3 — Images */}
        {tab === "images" && savedProductId && (
          <div className="flex flex-col gap-4 max-w-lg">
            <p className="text-sm text-slate-500">
              Max 10 files · 5 MB each · JPEG / PNG / WEBP
            </p>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-900">
                Applies to
              </label>
              <select
                value={imageVariantId}
                onChange={(e) => setImageVariantId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">General (all variants)</option>
                {(product?.variants ?? []).map((v) => (
                  <option key={v.variant_id} value={v.variant_id}>
                    Variant #{v.variant_id} — {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Pending selection — nothing uploads until "Upload" is clicked */}
            {pendingFiles.length > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">
                  {pendingFiles.length} selected — not uploaded yet
                </p>
                <div className="flex flex-wrap gap-2">
                  {pendingPreviews.map((url, i) => (
                    <div key={url} className="group relative">
                      <img
                        src={url}
                        alt=""
                        className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePendingFile(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs text-white opacity-0 transition group-hover:opacity-100 hover:cursor-pointer"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleImageUpload}
                    disabled={uploadingImages}
                    className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:cursor-pointer hover:shadow-xl active:translate-y-0 active:shadow-lg disabled:pointer-events-none disabled:opacity-50"
                  >
                    {uploadingImages
                      ? "Uploading…"
                      : `Upload ${pendingFiles.length} image${pendingFiles.length > 1 ? "s" : ""}`}
                  </button>
                  <button
                    type="button"
                    onClick={clearPendingFiles}
                    disabled={uploadingImages}
                    className="text-sm text-slate-500 hover:cursor-pointer hover:text-slate-800 hover:underline disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Already-uploaded images, grouped by variant */}
            {product?.images?.length ? (
              <div className="flex flex-col gap-4">
                <ImageGroup
                  label="General"
                  images={product.images.filter(
                    (img) => img.variant_id == null,
                  )}
                />
                {(product?.variants ?? []).map((v) => {
                  // NOTE: product.images only ever holds general (variant_id
                  // IS NULL) images — the API deliberately excludes
                  // variant-specific ones from that array (see
                  // findImagesByProduct). Each variant carries its own
                  // images via v.images instead.
                  const variantImages = v.images ?? [];
                  if (!variantImages.length) return null;
                  return (
                    <ImageGroup
                      key={v.variant_id}
                      label={`Variant #${v.variant_id} — ${v.name}`}
                      images={variantImages}
                    />
                  );
                })}
              </div>
            ) : (
              pendingFiles.length === 0 && (
                <p className="text-sm text-slate-400">No images yet.</p>
              )
            )}

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) =>
                e.target.files && handleFilesSelected(e.target.files)
              }
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImages}
              className="self-start rounded-xl border border-slate-300 px-5 py-2 text-sm text-slate-700 transition hover:cursor-pointer hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50"
            >
              Choose Images…
            </button>
          </div>
        )}

        {/* Tab 4 — Categories */}
        {tab === "categories" && savedProductId && (
          <div className="flex flex-col gap-4 max-w-sm">
            <p className="text-sm text-slate-500">
              Select all categories this product belongs to.
            </p>
            <div className="flex flex-col gap-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 p-4 text-slate-900">
              {categories.length === 0 ? (
                <p className="text-sm text-slate-400">No categories yet.</p>
              ) : (
                <CategoryCheckboxTree
                  nodes={categories}
                  selectedCategoryIds={selectedCategoryIds}
                  onToggle={toggleCategory}
                />
              )}
            </div>
            <button
              onClick={handleSaveCategories}
              disabled={savingCategories}
              className="self-start rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:cursor-pointer hover:shadow-xl active:translate-y-0 active:shadow-lg disabled:pointer-events-none disabled:opacity-50"
            >
              {savingCategories ? "Saving…" : "Save & Done"}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  function CategoryCheckboxTree({
    nodes,
    depth = 0,
    selectedCategoryIds,
    onToggle,
  }: {
    nodes: Category[];
    depth?: number;
    selectedCategoryIds: number[];
    onToggle: (category_id: number) => void;
  }) {
    return (
      <>
        {nodes.map((c) => (
          <div key={c.category_id}>
            <label
              className="flex items-center gap-2 py-1 text-sm"
              style={{ paddingLeft: depth * 20 }}
            >
              <input
                type="checkbox"
                checked={selectedCategoryIds.includes(c.category_id)}
                onChange={() => onToggle(c.category_id)}
                className="rounded"
              />
              <span
                className={
                  depth === 0 ? "font-medium text-slate-900" : "text-slate-600"
                }
              >
                {depth > 0 && <span className="text-slate-300">└ </span>}
                {c.name}
              </span>
            </label>
            {c.children && c.children.length > 0 && (
              <CategoryCheckboxTree
                nodes={c.children}
                depth={depth + 1}
                selectedCategoryIds={selectedCategoryIds}
                onToggle={onToggle}
              />
            )}
          </div>
        ))}
      </>
    );
  }

  function ImageGroup({
    label,
    images,
  }: {
    label: string;
    images: NonNullable<typeof product>["images"];
  }) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <img
              key={img.image_id}
              src={img.s3_url}
              alt=""
              className="h-20 w-20 rounded-lg object-cover border"
            />
          ))}
        </div>
      </div>
    );
  }
}
