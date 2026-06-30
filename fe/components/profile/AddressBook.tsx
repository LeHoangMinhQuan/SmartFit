"use client";

import { useEffect, useState } from "react";
import { userService } from "../../services/user.service";
import { toast } from "../ui/Toast";
import Spinner from "../ui/Spinner";
import AddressForm, { type AddressFormValues } from "../checkout/AddressForm";
import type { UserAddress } from "../../interfaces";

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

  async function handleAdd(e: React.FormEvent) {
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

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      {addresses.map((a) => (
        <div
          key={a.address_id}
          className="flex items-start justify-between rounded-xl border p-4"
        >
          <div className="text-sm">
            {a.label && <p className="font-medium text-gray-800">{a.label}</p>}
            <p className="text-gray-600">{a.address_line}</p>
            {a.is_default && (
              <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                Default
              </span>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {!a.is_default && (
              <button
                onClick={() => handleSetDefault(a.address_id)}
                className="text-xs text-blue-500 hover:underline"
              >
                Set default
              </button>
            )}
            <button
              onClick={() => handleDelete(a.address_id)}
              className="text-xs text-red-500 hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {adding ? (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-4 rounded-xl border p-4"
        >
          <p className="font-medium">New Address</p>
          <AddressForm value={form} onChange={setForm} />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-black px-5 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setForm({});
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
          className="rounded-xl border border-dashed border-gray-300 py-4 text-sm text-gray-500 hover:border-gray-500"
        >
          + Add new address
        </button>
      )}
    </div>
  );
}
