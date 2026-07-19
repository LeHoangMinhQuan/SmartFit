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
  const [saving, setSaving] = useState(false);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await adminService.createCategory({
        name: name.trim(),
        ...(parentId ? { parent_id: Number(parentId) } : {}),
      });
      toast.success("Category created.");
      setName("");
      setParentId("");
      setAdding(false);
      refresh();
    } catch {
      toast.error("Failed to create category.");
    } finally {
      setSaving(false);
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
          className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-b-0"
          style={{ paddingLeft: `${depth * 20 + 16}px` }}
        >
          <span className="text-sm text-slate-700">{c.name}</span>
          <div className="flex items-center gap-3 pr-4">
            <span className="text-xs text-slate-400">#{c.category_id}</span>
            <button
              onClick={() => handleDelete(c.category_id, c.name)}
              className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100 hover:cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
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
            Organize products into a category hierarchy.
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
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm max-w-xl"
        >
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            hint="Max 30 characters"
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Parent (optional)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">None (top-level)</option>
              {flat.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
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
