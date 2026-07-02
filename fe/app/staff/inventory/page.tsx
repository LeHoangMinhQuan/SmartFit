"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { inventoryService } from "../../../services/staff/inventory.service";
import { adminService } from "../../../services/staff/admin.service";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import Input from "../../../components/ui/Input";
import Spinner from "../../../components/ui/Spinner";
import type { Store } from "../../../interfaces";

type Tab = "stock" | "history";

interface InventoryRow {
  product_id: number;
  variant_id: number;
  store_id: number;
  quantity: number;
}

interface ImportRow {
  staff_id: number;
  supplier_id: number;
  product_id: number;
  variant_id: number;
  import_date: string;
}

export default function StaffInventoryPage() {
  const [tab, setTab] = useState<Tab>("stock");
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [stock, setStock] = useState<InventoryRow[]>([]);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null); // "product_id-variant_id"
  const [adjustQty, setAdjustQty] = useState<Record<string, string>>({});

  useEffect(() => {
    adminService
      .getStores()
      .then(setStores)
      .catch(() => {});
    inventoryService
      .getImportHistory()
      .then(setImports)
      .catch(() => {});
  }, []);

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

  return (
    <div className="p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Inventory</h1>

      {/* Store selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Store:</label>
        <select
          value={selectedStoreId}
          onChange={(e) => setSelectedStoreId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select a store…</option>
          {stores.map((s) => (
            <option key={s.store_id} value={s.store_id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["stock", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition capitalize",
              tab === t
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-800",
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
          <p className="text-sm text-gray-500">Select a store to view stock.</p>
        ) : (
          <DataTable
            columns={[
              { key: "product_id", header: "Product ID", className: "w-24" },
              { key: "variant_id", header: "Variant ID", className: "w-24" },
              { key: "quantity", header: "Current Stock" },
              {
                key: "adjust",
                header: "Set Quantity",
                render: (r) => {
                  const key = `${r.product_id}-${r.variant_id}`;
                  const busy = adjusting === key;
                  return (
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        min={0}
                        value={adjustQty[key] ?? ""}
                        onChange={(e) =>
                          setAdjustQty((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                        placeholder={String(r.quantity)}
                      />
                      <button
                        disabled={busy || !adjustQty[key]}
                        onClick={() =>
                          handleAdjust(
                            r.product_id as number,
                            r.variant_id as number,
                            r.store_id as number,
                          )
                        }
                        className="text-xs text-blue-500 hover:underline disabled:opacity-40"
                      >
                        {busy ? "…" : "Update"}
                      </button>
                    </div>
                  );
                },
              },
            ]}
            rows={stock as unknown as Record<string, unknown>[]}
            rowKey={(r) => `${r.product_id}-${r.variant_id}`}
            emptyMessage="No stock records for this store."
          />
        ))}

      {/* Import history tab */}
      {tab === "history" && (
        <DataTable
          columns={[
            { key: "product_id", header: "Product ID" },
            { key: "variant_id", header: "Variant ID" },
            { key: "supplier_id", header: "Supplier ID" },
            { key: "staff_id", header: "Staff ID" },
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
      )}
    </div>
  );
}
