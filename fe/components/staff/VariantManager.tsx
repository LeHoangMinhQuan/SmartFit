"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminService } from "../../services/staff/admin.service";
import { toast } from "../ui/Toast";
import Input from "../ui/Input";
import type { ProductVariant } from "../../interfaces";

interface Attribute {
  attribute_id: number;
  name: string;
}

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
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Global attribute catalog — loaded once, used by every variant's
  // "add attribute" dropdown below.
  const {
    data: catalog = [],
    isLoading: catalogLoading,
    isError: catalogError,
  } = useQuery({
    queryKey: ["staff", "attributes"],
    queryFn: () => adminService.getAttributes(),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (catalogError) toast.error("Failed to load attribute catalog.");
  }, [catalogError]);

  // variant_id is app-supplied per product (1, 2, 3…) — suggest the next
  // free integer as a starting point, but let staff override it.
  const nextSuggestedId =
    variants.length > 0
      ? Math.max(...variants.map((v) => v.variant_id)) + 1
      : 1;

  const createVariantMutation = useMutation({
    mutationFn: async (vars: { variant_id: number; form: NewVariantForm }) => {
      await adminService.createVariant(productId, {
        variant_id: vars.variant_id,
        name: vars.form.name.trim(),
      });

      // Price is a separate write — only call it if the staff filled it in.
      // A variant can exist without an active price row, but won't be
      // purchasable/displayed with a price until one is set.
      if (vars.form.base_price && vars.form.start_date && vars.form.end_date) {
        await adminService.upsertPrice(productId, vars.variant_id, {
          base_price: Number(vars.form.base_price),
          start_date: new Date(vars.form.start_date).toISOString(),
          end_date: new Date(vars.form.end_date).toISOString(),
        });
      }
    },
    onSuccess: () => {
      toast.success("Variant created.");
      setForm(emptyForm);
      setAdding(false);
      onChange();
    },
    onError: () => toast.error("Failed to create variant."),
  });
  const saving = createVariantMutation.isPending;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const variant_id = Number(form.variant_id || nextSuggestedId);
    if (!form.name.trim()) {
      toast.error("Variant name is required.");
      return;
    }
    createVariantMutation.mutate({ variant_id, form });
  }

  const deleteVariantMutation = useMutation({
    mutationFn: (variant_id: number) =>
      adminService.deleteVariant(productId, variant_id),
    onMutate: (variant_id) => setDeletingId(variant_id),
    onSuccess: () => {
      toast.success("Variant deleted.");
      onChange();
    },
    onError: () =>
      toast.error(
        "Failed to delete variant. It may have existing orders or stock.",
      ),
    onSettled: () => setDeletingId(null),
  });

  async function handleDeleteVariant(variant_id: number) {
    if (!confirm(`Delete variant #${variant_id}? This cannot be undone.`))
      return;
    deleteVariantMutation.mutate(variant_id);
  }

  return (
    <div className="flex flex-col gap-4">
      {variants.map((v) => (
        <VariantRow
          key={v.variant_id}
          productId={productId}
          variant={v}
          catalog={catalog}
          catalogLoading={catalogLoading}
          onDeleteVariant={() => handleDeleteVariant(v.variant_id)}
          deletingVariant={deletingId === v.variant_id}
          onChange={onChange}
        />
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

// ─────────────────────────────────────────────────────────────────────────────
// Per-variant row, broken out so each variant manages its own attribute-editing
// state (which catalog attribute is selected, the value being typed, etc.)
// without that state leaking across sibling variants.
// ─────────────────────────────────────────────────────────────────────────────

interface VariantRowProps {
  productId: number;
  variant: ProductVariant;
  catalog: Attribute[];
  catalogLoading: boolean;
  onDeleteVariant: () => void;
  deletingVariant: boolean;
  onChange: () => void;
}

function VariantRow({
  productId,
  variant,
  catalog,
  catalogLoading,
  onDeleteVariant,
  deletingVariant,
  onChange,
}: VariantRowProps) {
  const [addingAttr, setAddingAttr] = useState(false);
  const [selectedAttrId, setSelectedAttrId] = useState("");
  const [attrValue, setAttrValue] = useState("");

  // Inline edit state — keyed by attribute_id, holds the in-progress value
  const [editingAttrId, setEditingAttrId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [removingAttrId, setRemovingAttrId] = useState<number | null>(null);

  // product_attribute PK is (attribute_id, product_id, variant_id) — an
  // attribute already attached to this variant can't be attached again.
  // Filter it out of the "add" dropdown to avoid a guaranteed 409.
  const attachedIds = new Set(
    (variant.attributes ?? []).map((a) => a.attribute_id),
  );
  const availableCatalog = catalog.filter(
    (a) => !attachedIds.has(a.attribute_id),
  );

  const addAttributeMutation = useMutation({
    mutationFn: (vars: { attribute_id: number; value: string }) =>
      adminService.assignAttribute(productId, variant.variant_id, vars),
    onSuccess: () => {
      toast.success("Attribute added.");
      setAddingAttr(false);
      setSelectedAttrId("");
      setAttrValue("");
      onChange();
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) {
        toast.error("This attribute is already attached to this variant.");
      } else {
        toast.error("Failed to add attribute.");
      }
    },
  });
  const savingAddAttr = addAttributeMutation.isPending;

  async function handleAddAttribute(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAttrId || !attrValue.trim()) {
      toast.error("Select an attribute and enter a value.");
      return;
    }
    addAttributeMutation.mutate({
      attribute_id: Number(selectedAttrId),
      value: attrValue.trim(),
    });
  }

  function startEdit(attributeId: number, currentValue: string) {
    setEditingAttrId(attributeId);
    setEditValue(currentValue);
  }

  const saveEditMutation = useMutation({
    mutationFn: (vars: { attributeId: number; value: string }) =>
      adminService.updateAttributeValue(
        productId,
        variant.variant_id,
        vars.attributeId,
        vars.value,
      ),
    onSuccess: () => {
      toast.success("Attribute updated.");
      setEditingAttrId(null);
      onChange();
    },
    onError: () => toast.error("Failed to update attribute."),
  });
  const savingEditAttr = saveEditMutation.isPending;

  async function handleSaveEdit(attributeId: number) {
    if (!editValue.trim()) {
      toast.error("Value cannot be empty.");
      return;
    }
    saveEditMutation.mutate({ attributeId, value: editValue.trim() });
  }

  const removeAttributeMutation = useMutation({
    mutationFn: (attributeId: number) =>
      adminService.removeAttribute(productId, variant.variant_id, attributeId),
    onMutate: (attributeId) => setRemovingAttrId(attributeId),
    onSuccess: () => {
      toast.success("Attribute removed.");
      onChange();
    },
    onError: () => toast.error("Failed to remove attribute."),
    onSettled: () => setRemovingAttrId(null),
  });

  async function handleRemoveAttribute(attributeId: number) {
    if (!confirm("Remove this attribute from the variant?")) return;
    removeAttributeMutation.mutate(attributeId);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">
            #{variant.variant_id} — {variant.name}
          </p>
          <p className="text-xs text-gray-500">
            {variant.base_price
              ? `${variant.base_price.toLocaleString()}₫`
              : "No active price"}
            {" · "}
            Stock: {variant.stock ?? 0}
          </p>
        </div>
        <button
          onClick={onDeleteVariant}
          disabled={deletingVariant}
          className="text-xs text-red-500 hover:underline disabled:opacity-50"
        >
          {deletingVariant ? "Deleting…" : "Delete"}
        </button>
      </div>

      {/* Attributes — now fully editable via /api/products/:id/variants/:variant_id/attributes */}
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {(variant.attributes ?? []).map((a) =>
          editingAttrId === a.attribute_id ? (
            <span key={a.attribute_id} className="flex items-center gap-1">
              <span className="text-xs text-gray-500">{a.attribute_name}:</span>
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                maxLength={20}
                className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
              />
              <button
                onClick={() => handleSaveEdit(a.attribute_id)}
                disabled={savingEditAttr}
                className="text-xs text-green-600 hover:underline"
              >
                Save
              </button>
              <button
                onClick={() => setEditingAttrId(null)}
                className="text-xs text-gray-400 hover:underline"
              >
                Cancel
              </button>
            </span>
          ) : (
            <span
              key={a.attribute_id}
              className="group flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              {a.attribute_name}: {a.value}
              <button
                onClick={() => startEdit(a.attribute_id, a.value)}
                className="ml-1 text-gray-400 hover:text-gray-700"
                title="Edit"
              >
                ✎
              </button>
              <button
                onClick={() => handleRemoveAttribute(a.attribute_id)}
                disabled={removingAttrId === a.attribute_id}
                className="text-gray-400 hover:text-red-500"
                title="Remove"
              >
                ✕
              </button>
            </span>
          ),
        )}

        {addingAttr ? (
          <form
            onSubmit={handleAddAttribute}
            className="flex items-center gap-2"
          >
            <select
              value={selectedAttrId}
              onChange={(e) => setSelectedAttrId(e.target.value)}
              disabled={catalogLoading}
              className="rounded border border-gray-300 px-1.5 py-1 text-xs text-slate-900"
            >
              <option value="">
                {catalogLoading ? "Loading…" : "Choose attribute…"}
              </option>
              {availableCatalog.map((a) => (
                <option key={a.attribute_id} value={a.attribute_id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              value={attrValue}
              onChange={(e) => setAttrValue(e.target.value)}
              placeholder="Value"
              maxLength={20}
              className="w-20 rounded border border-gray-300 px-1.5 py-1 text-xs text-slate-900"
            />
            <button
              type="submit"
              disabled={savingAddAttr}
              className="text-xs text-green-600 hover:underline"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingAttr(false);
                setSelectedAttrId("");
                setAttrValue("");
              }}
              className="text-xs text-gray-400 hover:underline"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddingAttr(true)}
            disabled={catalogLoading || availableCatalog.length === 0}
            className="rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:border-gray-500 disabled:opacity-40"
            title={
              !catalogLoading && availableCatalog.length === 0
                ? "All catalog attributes are already attached"
                : undefined
            }
          >
            + Attribute
          </button>
        )}
      </div>
    </div>
  );
}
