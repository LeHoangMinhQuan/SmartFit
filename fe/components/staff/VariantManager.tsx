"use client";

import { useState } from "react";
import { adminService } from "../../services/staff/admin.service";
import { toast } from "../ui/Toast";
import Input from "../ui/Input";
import Spinner from "../ui/Spinner";
import type { ProductVariant } from "../../interfaces";

interface VariantManagerProps {
  productId: number;
  variants: ProductVariant[];
  onChange: () => void; // re-fetch product after any mutation
}

interface NewVariantForm {
  variant_id: string;
  name: string;
  base_price: string;
  start_date: string;
  end_date: string;
}

const emptyForm: NewVariantForm = {
  variant_id: "",
  name: "",
  base_price: "",
  start_date: "",
  end_date: "",
};

export default function VariantManager({
  productId,
  variants,
  onChange,
}: VariantManagerProps) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<NewVariantForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // variant_id is app-supplied per product (1, 2, 3…) — suggest the next
  // free integer as a starting point, but let staff override it.
  const nextSuggestedId =
    variants.length > 0
      ? Math.max(...variants.map((v) => v.variant_id)) + 1
      : 1;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const variant_id = Number(form.variant_id || nextSuggestedId);
    if (!form.name.trim()) {
      toast.error("Variant name is required.");
      return;
    }
    setSaving(true);
    try {
      await adminService.createVariant(productId, {
        variant_id,
        name: form.name.trim(),
      });

      // Price is a separate write — only call it if the staff filled it in.
      // A variant can exist without an active price row, but won't be
      // purchasable/displayed with a price until one is set.
      if (form.base_price && form.start_date && form.end_date) {
        await adminService.upsertPrice(productId, variant_id, {
          base_price: Number(form.base_price),
          start_date: form.start_date,
          end_date: form.end_date,
        });
      }

      toast.success("Variant created.");
      setForm(emptyForm);
      setAdding(false);
      onChange();
    } catch {
      toast.error("Failed to create variant.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(variant_id: number) {
    if (!confirm(`Delete variant #${variant_id}? This cannot be undone.`))
      return;
    setDeletingId(variant_id);
    try {
      await adminService.deleteVariant(productId, variant_id);
      toast.success("Variant deleted.");
      onChange();
    } catch {
      toast.error(
        "Failed to delete variant. It may have existing orders or stock.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {variants.map((v) => (
        <div
          key={v.variant_id}
          className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                #{v.variant_id} — {v.name}
              </p>
              <p className="text-xs text-gray-500">
                {v.base_price
                  ? `${v.base_price.toLocaleString()}₫`
                  : "No active price"}
                {" · "}
                Stock: {v.stock ?? 0}
              </p>
            </div>
            <button
              onClick={() => handleDelete(v.variant_id)}
              disabled={deletingId === v.variant_id}
              className="text-xs text-red-500 hover:underline disabled:opacity-50"
            >
              {deletingId === v.variant_id ? "Deleting…" : "Delete"}
            </button>
          </div>

          {/*
            ⚠ ATTRIBUTE EDITING BLOCKED ON BACKEND
            The API plan (ecommerce-api-plan.md §4 Products) documents no
            endpoint to create/update product_attribute rows — only
            GET /api/products/:id/variants returns them (read-only).
            Until a route like POST /api/products/:id/variants/:variant_id/attributes
            exists, attributes can only be viewed here, not edited.
            See plan Section 9 "Known Backend Gaps" for the full note.
          */}
          {v.attributes.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t pt-2">
              {v.attributes.map((a) => (
                <span
                  key={a.attribute_id}
                  className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {a.attribute_name}: {a.value}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-xl border border-dashed p-4"
        >
          <p className="text-sm font-medium">New Variant</p>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Variant ID"
              type="number"
              value={form.variant_id}
              onChange={(e) => setForm({ ...form, variant_id: e.target.value })}
              placeholder={String(nextSuggestedId)}
              hint="App-assigned per product"
            />
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <p className="mt-1 text-xs text-gray-500">
            Price (optional — can be set later)
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Base price"
              type="number"
              value={form.base_price}
              onChange={(e) => setForm({ ...form, base_price: e.target.value })}
            />
            <Input
              label="Start date"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            <Input
              label="End date"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-black px-5 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add Variant"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setForm(emptyForm);
              }}
              className="text-sm text-gray-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-gray-500"
        >
          + Add variant
        </button>
      )}
    </div>
  );
}
