"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";
import { inventoryService } from "../../../services/staff/inventory.service";
import { adminService } from "../../../services/staff/admin.service";
import { productService } from "../../../services/product.service";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import Spinner from "../../../components/ui/Spinner";
import Input from "../../../components/ui/Input";
import Pagination from "../../../components/ui/Pagination";
import type { Store, Supplier, PaginationMeta } from "../../../interfaces";

type Tab = "stock" | "history";

interface InventoryRow {
  product_id: number;
  variant_id: number;
  store_id: number;
  quantity: number;
}

interface ImportRow {
  staff_id: number;
  staff_name: string;
  supplier_id: number;
  supplier_name: string;
  product_id: number;
  product_name: string;
  variant_id: number;
  variant_name: string;
  store_id: number;
  store_name: string;
  quantity: number;
  import_date: string;
}

export default function StaffInventoryPage() {
  const [tab, setTab] = useState<Tab>("stock");
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [stock, setStock] = useState<InventoryRow[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [importsMeta, setImportsMeta] = useState<PaginationMeta | undefined>();
  const [importsPage, setImportsPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null); // "product_id-variant_id"
  const [adjustQty, setAdjustQty] = useState<Record<string, string>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showImportForm, setShowImportForm] = useState(false);
  const [importForm, setImportForm] = useState({
    supplier_id: "",
    product_id: "",
    variant_id: "",
    store_id: "",
    quantity: "",
    import_date: "",
  });
  const [savingImport, setSavingImport] = useState(false);

  function loadImportHistory(page: number) {
    inventoryService
      .getImportHistory({ page, limit: 10 })
      .then((res) => {
        setImports(res.data);
        setImportsMeta(res.meta);
      })
      .catch(() => {});
  }

  const productsQuery = useQuery({
    queryKey: ["staff-products-all"],
    queryFn: () => productService.getProducts({ limit: 100 }),
    enabled: showImportForm,
    staleTime: 5 * 60_000,
  });
  const products = productsQuery.data?.data ?? [];

  const selectedProductId = importForm.product_id
    ? Number(importForm.product_id)
    : null;

  const variantsQuery = useQuery({
    queryKey: ["staff-product-variants", selectedProductId],
    queryFn: () => productService.getVariants(selectedProductId!),
    enabled: selectedProductId != null,
    staleTime: 5 * 60_000,
  });
  const variants = variantsQuery.data ?? [];

  useEffect(() => {
    adminService
      .getStores()
      .then(setStores)
      .catch(() => {});
    adminService
      .getSuppliers()
      .then(setSuppliers)
      .catch(() => {});
    loadImportHistory(1);
  }, []);

  useEffect(() => {
    loadImportHistory(importsPage);
  }, [importsPage]);

  useEffect(() => {
    if (!selectedStoreId) return;
    setLoading(true);
    inventoryService
      .getInventory({ store_id: Number(selectedStoreId) })
      .then(setStock)
      .catch(() => toast.error("Failed to load inventory."))
      .finally(() => setLoading(false));
  }, [selectedStoreId]);

  async function handleAdjust(
    product_id: number,
    variant_id: number,
    store_id: number,
  ) {
    const key = `${product_id}-${variant_id}`;
    const qty = Number(adjustQty[key]);
    if (isNaN(qty) || qty < 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    setAdjusting(key);
    try {
      await inventoryService.adjustQuantity(product_id, variant_id, store_id, {
        quantity: qty,
      });
      setStock((prev) =>
        prev.map((r) =>
          r.product_id === product_id && r.variant_id === variant_id
            ? { ...r, quantity: qty }
            : r,
        ),
      );
      setAdjustQty((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success("Quantity updated.");
    } catch {
      toast.error("Failed to update quantity.");
    } finally {
      setAdjusting(null);
    }
  }

  function handleProductChange(value: string) {
    // Changing the product invalidates whatever variant was picked for the
    // previous product — variant_id is per-product, not globally unique.
    setImportForm({ ...importForm, product_id: value, variant_id: "" });
  }

  async function handleRecordImport(e: React.FormEvent) {
    e.preventDefault();
    const supplier_id = Number(importForm.supplier_id);
    const product_id = Number(importForm.product_id);
    const variant_id = Number(importForm.variant_id);
    const store_id = Number(importForm.store_id);
    const quantity = Number(importForm.quantity);

    if (!supplier_id || !product_id || !variant_id || !store_id) {
      toast.error("All fields except date are required.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Quantity must be a positive whole number.");
      return;
    }

    setSavingImport(true);
    try {
      await inventoryService.recordImport({
        supplier_id,
        product_id,
        variant_id,
        store_id,
        quantity,
        import_date: new Date(
          importForm.import_date || Date.now(),
        ).toISOString(),
      });
      toast.success("Import recorded — stock updated.");
      setImportForm({
        supplier_id: "",
        product_id: "",
        variant_id: "",
        store_id: "",
        quantity: "",
        import_date: "",
      });
      setShowImportForm(false);
      setImportsPage(1);
      loadImportHistory(1);
      if (selectedStoreId) {
        inventoryService
          .getInventory({ store_id: Number(selectedStoreId) })
          .then(setStock)
          .catch(() => {});
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 404) {
        toast.error("Supplier, product, variant, or store not found.");
      } else {
        toast.error("Failed to record import.");
      }
    } finally {
      setSavingImport(false);
    }
  }

  // Hidden while actively filling the Record Import form — that form has
  // its own Store field, and showing two "Store" selects on screen at once
  // (this one scoped to browsing Stock, the form's scoped to the import)
  // was confusing about which one actually mattered.
  const showTopStoreSelector = !(tab === "history" && showImportForm);

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Inventory</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track stock levels and review import history across stores.
        </p>
      </div>

      {/* Store selector */}
      {showTopStoreSelector && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Store:</label>
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="">Select a store…</option>
            {stores.map((s) => (
              <option
                key={s.store_id}
                value={s.store_id}
                className="text-slate-900"
              >
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["stock", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition capitalize hover:cursor-pointer",
              tab === t
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t === "stock" ? "Stock" : "Import History"}
          </button>
        ))}
      </div>

      {/* Stock tab */}
      {tab === "stock" &&
        (loading ? (
          <Spinner className="mx-auto mt-8" />
        ) : !selectedStoreId ? (
          <p className="text-sm text-slate-500">
            Select a store to view stock.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <DataTable
              columns={[
                { key: "product_id", header: "Product ID" },
                { key: "variant_id", header: "Variant ID" },
                { key: "quantity", header: "Current Stock" },
              ]}
              rows={stock as unknown as Record<string, unknown>[]}
              rowKey={(r) => `${r.product_id}-${r.variant_id}`}
              emptyMessage="No stock records for this store."
            />
          </div>
        ))}

      {/* Import history tab */}
      {tab === "history" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Recording an import adds to current stock immediately.
            </p>
            <button
              onClick={() => setShowImportForm((v) => !v)}
              className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 hover:cursor-pointer"
            >
              {showImportForm ? "Cancel" : "+ Record Import"}
            </button>
          </div>

          {showImportForm && (
            <form
              onSubmit={handleRecordImport}
              className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3"
            >
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-600">
                  Supplier
                </label>
                <select
                  value={importForm.supplier_id}
                  onChange={(e) =>
                    setImportForm({
                      ...importForm,
                      supplier_id: e.target.value,
                    })
                  }
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-black outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                  required
                >
                  <option value="">Select…</option>
                  {suppliers.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-600">
                  Store
                </label>
                <select
                  value={importForm.store_id}
                  onChange={(e) =>
                    setImportForm({ ...importForm, store_id: e.target.value })
                  }
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-black outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                  required
                >
                  <option value="">Select…</option>
                  {stores.map((s) => (
                    <option key={s.store_id} value={s.store_id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-600">
                  Product
                </label>
                <select
                  value={importForm.product_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  disabled={productsQuery.isLoading}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-black outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50"
                  required
                >
                  <option value="">
                    {productsQuery.isLoading ? "Loading…" : "Select…"}
                  </option>
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-600">
                  Variant
                </label>
                <select
                  value={importForm.variant_id}
                  onChange={(e) =>
                    setImportForm({
                      ...importForm,
                      variant_id: e.target.value,
                    })
                  }
                  disabled={!selectedProductId || variantsQuery.isLoading}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-black outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:opacity-50"
                  required
                >
                  <option value="">
                    {!selectedProductId
                      ? "Select a product first…"
                      : variantsQuery.isLoading
                        ? "Loading…"
                        : "Select…"}
                  </option>
                  {variants.map((v) => (
                    <option key={v.variant_id} value={v.variant_id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Quantity"
                type="number"
                min={1}
                value={importForm.quantity}
                onChange={(e) =>
                  setImportForm({ ...importForm, quantity: e.target.value })
                }
                required
              />
              <Input
                label="Import date"
                type="date"
                value={importForm.import_date}
                onChange={(e) =>
                  setImportForm({ ...importForm, import_date: e.target.value })
                }
                hint="Optional — defaults to now"
              />

              <div className="col-span-full">
                <button
                  type="submit"
                  disabled={savingImport}
                  className="rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2 text-sm text-white disabled:opacity-50 hover:bg-gray-800"
                >
                  {savingImport ? "Recording…" : "Record Import"}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <DataTable
              columns={[
                { key: "product_name", header: "Product" },
                { key: "variant_name", header: "Variant" },
                { key: "store_name", header: "Store" },
                { key: "quantity", header: "Quantity" },
                { key: "supplier_name", header: "Supplier" },
                { key: "staff_name", header: "Staff" },
                {
                  key: "import_date",
                  header: "Date",
                  render: (r) => String(r.import_date).split("T")[0],
                },
              ]}
              rows={imports as unknown as Record<string, unknown>[]}
              rowKey={(r) => `${r.product_id}-${r.variant_id}-${r.import_date}`}
              emptyMessage="No import history."
            />
          </div>
        </div>
      )}
    </div>
  );
}
