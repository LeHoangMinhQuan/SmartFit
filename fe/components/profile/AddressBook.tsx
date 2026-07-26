"use client";

import { useEffect, useState } from "react";
import { userService } from "../../services/user.service";
import { toast } from "../ui/Toast";
import Spinner from "../ui/Spinner";
import AddressForm, { type AddressFormValues } from "../checkout/AddressForm";
import type { UserAddress } from "../../interfaces";
import { Plus, Star, Trash2, Loader2, MapPin } from "lucide-react";

export default function AddressBook() {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<AddressFormValues>>({});

  async function refresh() {
    try {
      setAddresses(await userService.getAddresses());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd(e: React.SubmitEvent) {
    e.preventDefault();
    const { address_line, province_id, district_id, ward_id } = form;
    if (!address_line || !province_id || !district_id || !ward_id) {
      toast.error("Please fill all required fields.");
      return;
    }
    setSaving(true);
    try {
      await userService.addAddress(form as AddressFormValues);
      toast.success("Address added.");
      setAdding(false);
      setForm({});
      setLoading(true);
      refresh();
    } catch {
      toast.error("Failed to add address.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(address_id: number) {
    try {
      await userService.deleteAddress(address_id);
      toast.success("Address removed.");
      setAddresses((prev) => prev.filter((a) => a.address_id !== address_id));
    } catch {
      toast.error("Failed to remove address.");
    }
  }

  async function handleSetDefault(address_id: number) {
    try {
      await userService.setDefaultAddress(address_id);
      toast.success("Default address updated.");
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, is_default: a.address_id === address_id })),
      );
    } catch {
      toast.error("Failed to update default.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {addresses.map((a) => (
        <div
          key={a.address_id}
          className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300"
        >
          <div className="flex items-start gap-4">
            <div className="mt-1 rounded-full bg-slate-100 p-2 text-slate-500">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="text-sm">
              {a.label && (
                <p className="font-semibold text-slate-900">{a.label}</p>
              )}
              <p className="mt-0.5 text-slate-600">{a.address_line}</p>
              {a.is_default && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  <Star className="h-3 w-3 fill-emerald-700" />
                  Default Address
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <button
              onClick={() => handleDelete(a.address_id)}
              className="text-slate-400 transition hover:text-red-500"
              aria-label="Remove address"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            {!a.is_default && (
              <button
                onClick={() => handleSetDefault(a.address_id)}
                className="text-xs font-medium text-indigo-500 transition hover:text-indigo-600 hover:underline"
              >
                Set as default
              </button>
            )}
          </div>
        </div>
      ))}

      {adding ? (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-900">
            <MapPin className="h-4 w-4 text-indigo-500" />
            <h3 className="font-semibold">Add New Address</h3>
          </div>

          <AddressForm value={form} onChange={setForm} />

          <div className="mt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save Address"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setForm({});
              }}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-5 text-sm font-medium text-slate-500 transition hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600"
        >
          <Plus className="h-4 w-4" />
          Add new address
        </button>
      )}
    </div>
  );
}
