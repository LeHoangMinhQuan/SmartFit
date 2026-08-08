"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService } from "../../../services/staff/admin.service";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import Input from "../../../components/ui/Input";
import Spinner from "../../../components/ui/Spinner";
import type { Store } from "../../../interfaces";

type DetailTab = "inventory" | "staff";

export default function StaffStoresPage() {
  const queryClient = useQueryClient();
  const { data: stores = [], isLoading: loading } = useQuery({
    queryKey: ["staff-stores-list"],
    queryFn: () => adminService.getStores(),
  });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", address: "" });

  // Selected store detail
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("inventory");

  const selectedStore =
    stores.find((s) => s.store_id === selectedStoreId) ?? null;

  const detailQuery = useQuery({
    queryKey: ["staff-store-detail", selectedStoreId],
    queryFn: async () => {
      const [inv, staff] = await Promise.all([
        adminService.getStoreInventory(selectedStoreId!),
        adminService.getStoreStaff(selectedStoreId!),
      ]);
      return { inventory: inv, staff };
    },
    enabled: selectedStoreId != null,
  });
  const storeInventory = detailQuery.data?.inventory ?? [];
  const storeStaff = detailQuery.data?.staff ?? [];
  const detailLoading = detailQuery.isLoading;

  function handleSelectStore(store: Store) {
    setSelectedStoreId(store.store_id);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      adminService.createStore({ name: form.name, address: form.address }),
    onSuccess: () => {
      toast.success("Store created.");
      setForm({ name: "", address: "" });
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ["staff-stores-list"] });
    },
    onError: () => toast.error("Failed to create store."),
  });
  const saving = createMutation.isPending;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      toast.error("Name and address are required.");
      return;
    }
    createMutation.mutate();
  }

  const updateMutation = useMutation({
    mutationFn: (vars: {
      store_id: number;
      body: { name?: string; address?: string };
    }) => adminService.updateStore(vars.store_id, vars.body),
    onSuccess: (_data, vars) => {
      queryClient.setQueryData<Store[]>(["staff-stores-list"], (old) =>
        old?.map((s) =>
          s.store_id === vars.store_id ? { ...s, ...vars.body } : s,
        ),
      );
      toast.success("Store updated.");
    },
    onError: () => toast.error("Failed to update store."),
  });

  async function handleUpdate(
    store_id: number,
    body: { name?: string; address?: string },
  ) {
    updateMutation.mutate({ store_id, body });
  }

  const setActiveMutation = useMutation({
    mutationFn: (vars: { store_id: number; is_active: boolean }) =>
      adminService.setStoreActive(vars.store_id, vars.is_active),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.is_active ? "Store reactivated." : "Store deactivated.",
      );
      queryClient.setQueryData<Store[]>(["staff-stores-list"], (old) =>
        old?.map((s) =>
          s.store_id === vars.store_id
            ? { ...s, is_active: vars.is_active }
            : s,
        ),
      );
    },
    onError: () => toast.error("Failed to update store status."),
  });
  const updatingActiveId = setActiveMutation.isPending
    ? setActiveMutation.variables?.store_id
    : null;

  function handleToggleActive(store: Store) {
    if (
      store.is_active &&
      !confirm(
        `Deactivate "${store.name}"? It'll be hidden from staff assignment and inventory pickers, but its history is kept and you can reactivate it anytime.`,
      )
    )
      return;
    setActiveMutation.mutate({
      store_id: store.store_id,
      is_active: !store.is_active,
    });
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
        <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">Heads up — single-store limitation</p>
          <p className="mt-1 text-amber-700">
            Our GHN (shipping) account is currently registered under one store
            address only. Orders shipped from any store other than that one
            won&rsquo;t get real GHN shipping-fee/service quotes. Only add a
            second store if you&rsquo;ve also registered it with GHN, or if
            it&rsquo;s a pickup-only / non-shipping location.
          </p>
        </div>
      )}

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
            <div key={s.store_id} className="relative">
              <button
                onClick={() => handleSelectStore(s)}
                className={clsx(
                  "w-full rounded-2xl border p-4 pr-24 text-left transition hover:cursor-pointer",
                  !s.is_active && "opacity-60",
                  selectedStore?.store_id === s.store_id
                    ? "border-transparent bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/25"
                    : "border-slate-200 bg-white shadow-sm hover:border-slate-300",
                )}
              >
                <div className="flex items-center gap-2">
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
                  {!s.is_active && (
                    <span
                      className={clsx(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        selectedStore?.store_id === s.store_id
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      Inactive
                    </span>
                  )}
                </div>
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleActive(s);
                }}
                disabled={updatingActiveId === s.store_id}
                title={s.is_active ? "Deactivate store" : "Reactivate store"}
                className={clsx(
                  "absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium transition hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                  selectedStore?.store_id === s.store_id
                    ? "text-white/80 hover:bg-white/10 hover:text-white"
                    : s.is_active
                      ? "text-red-500 hover:bg-red-50"
                      : "text-emerald-600 hover:bg-emerald-50",
                )}
              >
                {updatingActiveId === s.store_id
                  ? "…"
                  : s.is_active
                    ? "Deactivate"
                    : "Reactivate"}
              </button>
            </div>
          ))}
          {stores.length === 0 && (
            <p className="text-sm text-slate-500">No stores yet.</p>
          )}
        </div>

        {/* Store detail */}
        {selectedStore && (
          <div className="flex flex-col gap-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedStore.name}
                </h2>
                {!selectedStore.is_active && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Inactive
                  </span>
                )}
              </div>
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
