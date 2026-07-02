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
          className="flex items-center justify-between border-b py-2.5"
          style={{ paddingLeft: `${depth * 20 + 16}px` }}
        >
          <span className="text-sm">{c.name}</span>
          <div className="flex gap-3 pr-4 text-xs">
            <span className="text-gray-400">#{c.category_id}</span>
            <button
              onClick={() => handleDelete(c.category_id, c.name)}
              className="text-red-500 hover:underline"
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          + New Category
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleCreate}
          className="flex items-end gap-3 rounded-xl border p-4 max-w-md"
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
            <label className="text-sm font-medium text-gray-700">
              Parent (optional)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
              className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
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
              className="text-sm text-gray-400 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border">
        {categories.length ? (
          renderTree(categories)
        ) : (
          <p className="p-6 text-center text-sm text-gray-500">
            No categories yet.
          </p>
        )}
      </div>
    </div>
  );
}
