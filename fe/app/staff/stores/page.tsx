"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { adminService } from "../../../services/staff/admin.service";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import Input from "../../../components/ui/Input";
import Spinner from "../../../components/ui/Spinner";
import type { Staff, Store } from "../../../interfaces";

type DetailTab = "inventory" | "staff";

interface StoreInventoryRow {
  product_id: number;
  variant_id: number;
  store_id: number;
  quantity: number;
}

export default function StaffStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", address: "" });

  // Selected store detail
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("inventory");
  const [storeInventory, setStoreInventory] = useState<StoreInventoryRow[]>([]);
  const [storeStaff, setStoreStaff] = useState<Staff[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    adminService
      .getStores()
      .then(setStores)
      .catch(() => toast.error("Failed to load stores."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSelectStore(store: Store) {
    setSelectedStore(store);
    setDetailLoading(true);
    try {
      const [inv, staff] = await Promise.all([
        adminService.getStoreInventory(store.store_id),
        adminService.getStoreStaff(store.store_id),
      ]);
      setStoreInventory(inv);
      setStoreStaff(staff);
    } catch {
      toast.error("Failed to load store details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      toast.error("Name and address are required.");
      return;
    }
    setSaving(true);
    try {
      await adminService.createStore({
        name: form.name,
        address: form.address,
      });
      toast.success("Store created.");
      setForm({ name: "", address: "" });
      setAdding(false);
      refresh();
    } catch {
      toast.error("Failed to create store.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(
    store_id: number,
    body: { name?: string; address?: string },
  ) {
    try {
      await adminService.updateStore(store_id, body);
      setStores((prev) =>
        prev.map((s) => (s.store_id === store_id ? { ...s, ...body } : s)),
      );
      if (selectedStore?.store_id === store_id) {
        setSelectedStore((prev) => (prev ? { ...prev, ...body } : prev));
      }
      toast.success("Store updated.");
    } catch {
      toast.error("Failed to update store.");
    }
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
          <h1 className="text-3xl font-bold text-slate-900">Stores</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage store locations, inventory and assigned staff.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:cursor-pointer active:translate-y-0 active:shadow-lg"
        >
          {adding ? "Cancel" : "+ New Store"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleCreate}
          className="flex flex-wrap gap-4 items-end rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-lg"
        >
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:cursor-pointer active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
          >
            {saving ? "…" : "Save"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Store list */}
        <div className="flex flex-col gap-2 lg:col-span-1">
          {stores.map((s) => (
            <button
              key={s.store_id}
              onClick={() => handleSelectStore(s)}
              className={clsx(
                "rounded-2xl border p-4 text-left transition hover:cursor-pointer",
                selectedStore?.store_id === s.store_id
                  ? "border-transparent bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/25"
                  : "border-slate-200 bg-white shadow-sm hover:border-slate-300",
              )}
            >
              <p
                className={clsx(
                  "text-sm font-medium",
                  selectedStore?.store_id === s.store_id
                    ? "text-white"
                    : "text-slate-900",
                )}
              >
                {s.name}
              </p>
              <p
                className={clsx(
                  "text-xs mt-0.5 truncate",
                  selectedStore?.store_id === s.store_id
                    ? "text-indigo-100"
                    : "text-slate-500",
                )}
              >
                {s.address}
              </p>
            </button>
          ))}
          {stores.length === 0 && (
            <p className="text-sm text-slate-500">No stores yet.</p>
          )}
        </div>

        {/* Store detail */}
        {selectedStore && (
          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {selectedStore.name}
              </h2>
              <button
                onClick={() => {
                  const newName = prompt("New name:", selectedStore.name);
                  if (newName && newName !== selectedStore.name) {
                    handleUpdate(selectedStore.store_id, { name: newName });
                  }
                }}
                className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-100 hover:cursor-pointer"
              >
                Rename
              </button>
            </div>

            <div className="flex gap-1 border-b border-slate-200">
              {(["inventory", "staff"] as DetailTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setDetailTab(t)}
                  className={clsx(
                    "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition capitalize hover:cursor-pointer",
                    detailTab === t
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-800",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {detailLoading ? (
              <Spinner className="mx-auto" />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {detailTab === "inventory" ? (
                  <DataTable
                    columns={[
                      { key: "product_id", header: "Product ID" },
                      { key: "variant_id", header: "Variant ID" },
                      { key: "quantity", header: "Quantity" },
                    ]}
                    rows={
                      storeInventory as unknown as Record<string, unknown>[]
                    }
                    rowKey={(r) => `${r.product_id}-${r.variant_id}`}
                    emptyMessage="No stock records for this store."
                  />
                ) : (
                  <DataTable
                    columns={[
                      { key: "staff_id", header: "ID", className: "w-16" },
                      { key: "name", header: "Name" },
                    ]}
                    rows={storeStaff as unknown as Record<string, unknown>[]}
                    rowKey={(r) => r.staff_id as number}
                    emptyMessage="No staff currently assigned to this store."
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
