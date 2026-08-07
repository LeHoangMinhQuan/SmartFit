"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService } from "../../../services/staff/admin.service";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import Input from "../../../components/ui/Input";
import Spinner from "../../../components/ui/Spinner";

interface Supplier {
  supplier_id: number;
  name: string;
}

export default function StaffSuppliersPage() {
  const queryClient = useQueryClient();
  const { data: suppliers = [], isLoading: loading } = useQuery({
    queryKey: ["staff-suppliers-list"],
    queryFn: async () => {
      const res = await adminService.getSuppliers();
      return Array.isArray(res) ? res : [];
    },
  });

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const createMutation = useMutation({
    mutationFn: () => adminService.createSupplier({ name: newName.trim() }),
    onSuccess: () => {
      toast.success("Supplier created.");
      setNewName("");
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ["staff-suppliers-list"] });
    },
    onError: () => toast.error("Failed to create supplier."),
  });
  const creating = createMutation.isPending;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    createMutation.mutate();
  }

  function startEdit(s: Supplier) {
    setEditingId(s.supplier_id);
    setEditName(s.name);
  }

  const updateMutation = useMutation({
    mutationFn: (supplier_id: number) =>
      adminService.updateSupplier(supplier_id, { name: editName.trim() }),
    onSuccess: () => {
      toast.success("Supplier updated.");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["staff-suppliers-list"] });
    },
    onError: () => toast.error("Failed to update supplier."),
  });
  const savingEdit = updateMutation.isPending;

  async function handleSaveEdit(supplier_id: number) {
    if (!editName.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    updateMutation.mutate(supplier_id);
  }

  const deleteMutation = useMutation({
    mutationFn: (supplier_id: number) =>
      adminService.deleteSupplier(supplier_id),
    onSuccess: () => {
      toast.success("Supplier deleted.");
      queryClient.invalidateQueries({ queryKey: ["staff-suppliers-list"] });
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) {
        toast.error(
          "Cannot delete — this supplier has existing import history.",
        );
      } else {
        toast.error("Failed to delete supplier.");
      }
    },
  });
  const deletingId = deleteMutation.isPending ? deleteMutation.variables : null;

  async function handleDelete(supplier_id: number) {
    if (!confirm("Delete this supplier? This cannot be undone.")) return;
    deleteMutation.mutate(supplier_id);
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage suppliers used when recording inventory imports.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className={clsx(
            "rounded-xl px-4 py-2 text-sm font-medium transition hover:cursor-pointer",
            adding
              ? "border border-slate-300 text-slate-600 hover:bg-slate-100"
              : "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 hover:shadow-xl",
          )}
        >
          {adding ? "Cancel" : "+ Add Supplier"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleCreate}
          className="flex items-end gap-3 rounded-2xl border border-dashed border-slate-300 p-4"
        >
          <div className="w-64">
            <Input
              variant="indigo"
              label="Supplier name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={30}
              required
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:cursor-pointer hover:shadow-xl active:translate-y-0 active:shadow-lg disabled:pointer-events-none disabled:opacity-50"
          >
            {creating ? "Saving…" : "Create"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <Spinner className="mx-auto my-12" />
        ) : (
          <DataTable
            columns={[
              { key: "supplier_id", header: "ID", className: "w-20" },
              {
                key: "name",
                header: "Name",
                render: (r) =>
                  editingId === r.supplier_id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={30}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    String(r.name)
                  ),
              },
              {
                key: "actions",
                header: "",
                className: "w-40",
                render: (r) => {
                  const id = r.supplier_id as number;
                  const isEditing = editingId === id;
                  return (
                    <div
                      className="flex items-center gap-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(id)}
                            disabled={savingEdit}
                            className="text-xs font-medium text-emerald-600 hover:cursor-pointer hover:underline disabled:opacity-50"
                          >
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-slate-400 hover:cursor-pointer hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(r as unknown as Supplier)}
                            className="text-xs font-medium text-blue-600 hover:cursor-pointer hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            disabled={deletingId === id}
                            className="text-xs font-medium text-red-500 hover:cursor-pointer hover:underline disabled:opacity-50"
                          >
                            {deletingId === id ? "…" : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                  );
                },
              },
            ]}
            rows={suppliers as unknown as Record<string, unknown>[]}
            rowKey={(r) => r.supplier_id as number}
            emptyMessage="No suppliers yet."
          />
        )}
      </div>
    </div>
  );
}
