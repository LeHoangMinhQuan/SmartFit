"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminService } from "../../../services/staff/admin.service";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import Input from "../../../components/ui/Input";
import type { Staff } from "../../../interfaces";

export default function StaffListPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    birth_date: "",
    start_time: "",
    password_hash: "",
  });

  async function refresh() {
    setLoading(true);
    adminService
      .getStaffList()
      .then(setStaffList)
      .catch(() => toast.error("Failed to load staff."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.password_hash.trim()) {
      toast.error("Name and password are required.");
      return;
    }
    setSaving(true);
    try {
      await adminService.createStaff({
        name: form.name,
        ...(form.birth_date ? { birth_date: form.birth_date } : {}),
        ...(form.start_time ? { start_time: form.start_time } : {}),
        password_hash: form.password_hash,
      });
      toast.success("Staff member created.");
      setForm({ name: "", birth_date: "", start_time: "", password_hash: "" });
      setAdding(false);
      refresh();
    } catch {
      toast.error("Failed to create staff member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Staff</h1>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          {adding ? "Cancel" : "+ New Staff"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-2 gap-4 rounded-xl border p-5 max-w-lg"
        >
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            value={form.password_hash}
            onChange={(e) =>
              setForm({ ...form, password_hash: e.target.value })
            }
            required
            hint="Will be hashed server-side"
          />
          <Input
            label="Birth Date"
            type="date"
            value={form.birth_date}
            onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
          />
          <Input
            label="Start Date"
            type="date"
            value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          />
          <button
            type="submit"
            disabled={saving}
            className="col-span-2 self-start rounded-lg bg-black px-5 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Staff Member"}
          </button>
        </form>
      )}

      <DataTable
        columns={[
          { key: "staff_id", header: "ID", className: "w-16" },
          { key: "name", header: "Name" },
          {
            key: "birth_date",
            header: "Birth Date",
            render: (r) =>
              r.birth_date ? String(r.birth_date).split("T")[0] : "—",
          },
          {
            key: "start_time",
            header: "Start Date",
            render: (r) =>
              r.start_time ? String(r.start_time).split("T")[0] : "—",
          },
        ]}
        rows={staffList as unknown as Record<string, unknown>[]}
        rowKey={(r) => r.staff_id as number}
        loading={loading}
        onRowClick={(r) => router.push(`/staff/staff/${r.staff_id as number}`)}
        emptyMessage="No staff members."
      />
    </div>
  );
}
