"use client";

import { useEffect, useState } from "react";
import { categoryService } from "../../../services/category.service";
import { adminService } from "../../../services/staff/admin.service";
import { toast } from "../../../components/ui/Toast";
import Input from "../../../components/ui/Input";
import Spinner from "../../../components/ui/Spinner";
import type { Category } from "../../../interfaces";

export default function StaffCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [displayOrder, setDisplayOrder] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline "manage featured" state for existing rows
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFeatured, setEditFeatured] = useState(false);
  const [editOrder, setEditOrder] = useState<string>("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);

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

  async function refresh() {
    setLoading(true);
    categoryService
      .getCategories()
      .then(setCategories)
      .catch(() => toast.error("Failed to load categories."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  function isDuplicateNameError(err: unknown): boolean {
    // axios error shape
    const status = (err as { response?: { status?: number } })?.response
      ?.status;
    return status === 409;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { category_id } = await adminService.createCategory({
        name: name.trim(),
        ...(parentId ? { parent_id: Number(parentId) } : {}),
        ...(isFeatured ? { is_featured: true } : {}),
        ...(isFeatured && displayOrder
          ? { display_order: Number(displayOrder) }
          : {}),
      });

      if (isFeatured && imageFile) {
        try {
          await adminService.uploadCategoryImage(category_id, imageFile);
        } catch {
          toast.error(
            "Category created, but the image failed to upload. You can add it from the row below.",
          );
        }
      }

      toast.success("Category created.");
      setName("");
      setParentId("");
      setIsFeatured(false);
      setDisplayOrder("");
      setImageFile(null);
      setAdding(false);
      refresh();
    } catch (err) {
      if (isDuplicateNameError(err)) {
        toast.error("A category with this name already exists.");
      } else {
        toast.error("Failed to create category.");
      }
    } finally {
      setSaving(false);
    }
  }

  function startEditing(c: Category) {
    setEditingId(c.category_id);
    setEditFeatured(!!c.is_featured);
    setEditOrder(c.display_order != null ? String(c.display_order) : "");
    setEditImageFile(null);
  }

  async function handleSaveFeatured(c: Category) {
    setEditSaving(true);
    try {
      await adminService.updateCategory(c.category_id, {
        is_featured: editFeatured,
        display_order: editFeatured && editOrder ? Number(editOrder) : null,
      });

      if (editFeatured && editImageFile) {
        await adminService.uploadCategoryImage(c.category_id, editImageFile);
      }

      toast.success("Category updated.");
      setEditingId(null);
      refresh();
    } catch (err) {
      if (isDuplicateNameError(err)) {
        toast.error("A category with this name already exists.");
      } else {
        toast.error("Failed to update category.");
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(category_id: number, categoryName: string) {
    if (
      !confirm(
        `Delete "${categoryName}"? This may affect products in this category.`,
      )
    )
      return;
    try {
      await adminService.deleteCategory(category_id);
      toast.success("Category deleted.");
      refresh();
    } catch {
      toast.error("Failed to delete category. It may have products assigned.");
    }
  }

  const flat = flattenCategories(categories);

  function renderTree(nodes: Category[], depth = 0): React.ReactNode {
    return nodes.map((c) => (
      <div key={c.category_id}>
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2.5 last:border-b-0"
          style={{ paddingLeft: `${depth * 20 + 16}px` }}
        >
          <div className="flex items-center gap-2">
            {c.is_featured && c.image_url ? (
              <img
                src={c.image_url}
                alt={c.name}
                className="h-8 w-8 rounded-md object-cover"
              />
            ) : null}
            <span className="text-sm text-slate-700">{c.name}</span>
            {c.is_featured && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                ★ Featured
                {c.display_order != null ? ` #${c.display_order}` : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 pr-4">
            <span className="text-xs text-slate-400">#{c.category_id}</span>
            <button
              onClick={() => startEditing(c)}
              className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100 hover:cursor-pointer"
            >
              {c.is_featured ? "Manage" : "Feature"}
            </button>
            <button
              onClick={() => handleDelete(c.category_id, c.name)}
              className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100 hover:cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>

        {editingId === c.category_id && (
          <div
            className="flex flex-wrap items-start gap-4 border-b border-slate-100 bg-slate-50 p-4"
            style={{ paddingLeft: `${depth * 20 + 16}px` }}
          >
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editFeatured}
                onChange={(e) => setEditFeatured(e.target.checked)}
              />
              Show on homepage
            </label>

            {editFeatured && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">
                    Display order
                  </label>
                  <input
                    type="number"
                    value={editOrder}
                    onChange={(e) => setEditOrder(e.target.value)}
                    className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm text-black"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">
                    {c.image_url ? "Replace image" : "Homepage image"}
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) =>
                      setEditImageFile(e.target.files?.[0] ?? null)
                    }
                    className="text-xs text-gray-600"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 self-center">
              <button
                onClick={() => handleSaveFeatured(c)}
                disabled={editSaving}
                className="rounded-lg bg-indigo-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
              >
                {editSaving ? "…" : "Save"}
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {c.children?.length ? renderTree(c.children, depth + 1) : null}
      </div>
    ));
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organize products into a category hierarchy. Mark a category as
            featured to show it on the homepage.
          </p>
        </div>

        <button
          onClick={() => setAdding(true)}
          className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:cursor-pointer active:translate-y-0 active:shadow-lg"
        >
          + New Category
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleCreate}
          className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm max-w-2xl"
        >
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            hint="Max 30 characters"
            required
            className="text-slate-700"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Parent (optional)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              <option value="">None (top-level)</option>
              {flat.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex w-full flex-col gap-2 border-t border-slate-100 pt-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
              />
              Show on homepage
            </label>

            {isFeatured && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">
                    Display order
                  </label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm text-black"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600">
                    Homepage image
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 self-center">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:cursor-pointer active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
            >
              {saving ? "…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setName("");
                setParentId("");
                setIsFeatured(false);
                setDisplayOrder("");
                setImageFile(null);
              }}
              className="rounded-xl border border-slate-400 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:cursor-pointer active:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {categories.length ? (
          renderTree(categories)
        ) : (
          <p className="p-6 text-center text-sm text-slate-500">
            No categories yet.
          </p>
        )}
      </div>
    </div>
  );
}
