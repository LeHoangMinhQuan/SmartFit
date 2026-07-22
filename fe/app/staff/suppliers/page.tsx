"use client";

import { useEffect, useState } from "react";
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    adminService
      .getSuppliers()
      .then((res) => setSuppliers(Array.isArray(res) ? res : []))
      .catch(() => toast.error("Failed to load suppliers."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    setCreating(true);
    try {
      await adminService.createSupplier({ name: newName.trim() });
      toast.success("Supplier created.");
      setNewName("");
      setAdding(false);
      load();
    } catch {
      toast.error("Failed to create supplier.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(s: Supplier) {
    setEditingId(s.supplier_id);
    setEditName(s.name);
  }

  async function handleSaveEdit(supplier_id: number) {
    if (!editName.trim()) {
      toast.error("Supplier name is required.");
      return;
    }
    setSavingEdit(true);
    try {
      await adminService.updateSupplier(supplier_id, { name: editName.trim() });
      toast.success("Supplier updated.");
      setEditingId(null);
      load();
    } catch {
      toast.error("Failed to update supplier.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(supplier_id: number) {
    if (!confirm("Delete this supplier? This cannot be undone.")) return;
    setDeletingId(supplier_id);
    try {
      await adminService.deleteSupplier(supplier_id);
      toast.success("Supplier deleted.");
      load();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 409) {
        toast.error(
          "Cannot delete — this supplier has existing import history.",
        );
      } else {
        toast.error("Failed to delete supplier.");
      }
    } finally {
      setDeletingId(null);
    }
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
          className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 hover:cursor-pointer"
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
            className="rounded-lg bg-black px-5 py-2 text-sm text-white disabled:opacity-50 hover:bg-gray-800"
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
                      className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
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
                            className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50"
                          >
                            {savingEdit ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-slate-400 hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(r as unknown as Supplier)}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(id)}
                            disabled={deletingId === id}
                            className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
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
