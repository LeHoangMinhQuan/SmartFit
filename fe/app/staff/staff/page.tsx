"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService } from "../../../services/staff/admin.service";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import Input from "../../../components/ui/Input";
import type { Role } from "../../../interfaces";

export default function StaffListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading: loading } = useQuery({
    queryKey: ["staff-staff-list"],
    queryFn: () => adminService.getStaffList(),
  });
  const staffList = data ?? [];

  // Roles for the create form's role picker — same source the staff
  // detail page's Roles tab uses (adminService.getRoles()).
  const { data: allRoles = [] } = useQuery({
    queryKey: ["staff-roles"],
    queryFn: () => adminService.getRoles(),
  });

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    birth_date: "",
    start_time: "",
    password: "",
  });
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

  function toggleRole(role_id: number) {
    setSelectedRoleIds((prev) =>
      prev.includes(role_id)
        ? prev.filter((id) => id !== role_id)
        : [...prev, role_id],
    );
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const { staff_id } = await adminService.createStaff({
        name: form.name,
        ...(form.birth_date ? { birth_date: form.birth_date } : {}),
        ...(form.start_time ? { start_time: form.start_time } : {}),
        password: form.password,
      });
      // No combined "create + assign roles" endpoint on the backend —
      // POST /admin/staff only takes name/birth_date/start_time/password
      // (see StaffService.createStaff). Assign roles as a follow-up step
      // with the new staff_id, same POST /admin/staff/:id/roles call the
      // detail page's Roles tab already uses one at a time. Run them in
      // parallel since each role assignment is independent.
      if (selectedRoleIds.length > 0) {
        await Promise.all(
          selectedRoleIds.map((role_id) =>
            adminService.assignRole(staff_id, role_id),
          ),
        );
      }
      return staff_id;
    },
    onSuccess: () => {
      toast.success("Staff member created.");
      setForm({ name: "", birth_date: "", start_time: "", password: "" });
      setSelectedRoleIds([]);
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ["staff-staff-list"] });
    },
    onError: () =>
      toast.error(
        "Failed to create staff member. Any roles that didn't get assigned can be added from their detail page.",
      ),
  });
  const saving = createMutation.isPending;

  async function handleCreate(e: React.SubmitEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.password.trim()) {
      toast.error("Name and password are required.");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Staff</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage staff accounts and onboarding details.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:cursor-pointer active:translate-y-0 active:shadow-lg"
        >
          {adding ? "Cancel" : "+ New Staff"}
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-lg"
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
            passwordToggle
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
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
          <div className="col-span-2 flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Roles</label>
            {allRoles.length === 0 ? (
              <p className="text-xs text-gray-500">No roles defined yet.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {allRoles.map((r: Role) => (
                  <label
                    key={r.role_id}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(r.role_id)}
                      onChange={() => toggleRole(r.role_id)}
                      className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                    />
                    {r.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="col-span-2 self-start rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:cursor-pointer active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
          >
            {saving ? "Creating…" : "Create Staff Member"}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
          onRowClick={(r) =>
            router.push(`/staff/staff/${r.staff_id as number}`)
          }
          emptyMessage="No staff members."
        />
      </div>
    </div>
  );
}
