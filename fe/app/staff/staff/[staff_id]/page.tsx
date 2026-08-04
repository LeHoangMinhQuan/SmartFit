"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminService } from "../../../../services/staff/admin.service";
import { toast } from "../../../../components/ui/Toast";
import Spinner from "../../../../components/ui/Spinner";
import Input from "../../../../components/ui/Input";
import type { Role } from "../../../../interfaces";

type Tab = "info" | "roles" | "history" | "transfer";

interface StaffHistory {
  history_id: number;
  staff_id: number;
  store_id: number;
  start_date: string;
  end_date: string | null;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "info", label: "Info" },
  { key: "roles", label: "Roles" },
  { key: "history", label: "Work History" },
  { key: "transfer", label: "Transfer" },
];

export default function StaffDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams<{ staff_id: string }>();

  const staffId = Number(params.staff_id);

  const [tab, setTab] = useState<Tab>("info");

  const detailQuery = useQuery({
    queryKey: ["staff-detail", staffId],
    queryFn: async () => {
      const [s, allR, hist, storeList] = await Promise.all([
        adminService.getStaff(staffId),
        adminService.getRoles(),
        adminService.getStaffHistory(staffId),
        adminService.getStores(),
      ]);
      return { staff: s, allRoles: allR, history: hist, stores: storeList };
    },
  });
  const staff = detailQuery.data?.staff ?? null;
  const allRoles = detailQuery.data?.allRoles ?? [];
  const history: StaffHistory[] = detailQuery.data?.history ?? [];
  const stores = detailQuery.data?.stores ?? [];
  const loading = detailQuery.isLoading;

  useEffect(() => {
    if (detailQuery.isError) toast.error("Failed to load staff detail.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.isError]);

  const [roles, setRoles] = useState<Role[]>([]);
  // BUG FIX: this previously never populated from the fetched staff detail
  // at all — it only ever changed in-session via the assign/remove
  // mutations below, so the Roles tab showed "No roles assigned" for
  // every staff member on first load regardless of their actual roles.
  // GET /admin/staff/:staff_id already returns `roles` (see
  // StaffService.getStaff on the backend) — just wasn't being read here.
  useEffect(() => {
    if (staff) setRoles(staff.roles ?? []);
  }, [staff]);

  // Edit info state — reset when staff loads
  const [editName, setEditName] = useState("");
  useEffect(() => {
    if (staff) setEditName(staff.name);
  }, [staff]);

  // Transfer state
  const [transferStoreId, setTransferStoreId] = useState("");

  // Role assign state
  const [assignRoleId, setAssignRoleId] = useState("");

  const saveInfoMutation = useMutation({
    mutationFn: () => adminService.updateStaff(staffId, { name: editName }),
    onSuccess: () => {
      queryClient.setQueryData(
        ["staff-detail", staffId],
        (old: typeof detailQuery.data) =>
          old && { ...old, staff: { ...old.staff, name: editName } },
      );
      toast.success("Staff info updated.");
    },
    onError: () => toast.error("Failed to update staff info."),
  });
  const savingInfo = saveInfoMutation.isPending;

  async function handleSaveInfo(e: React.SubmitEvent) {
    e.preventDefault();
    saveInfoMutation.mutate();
  }

  const assignRoleMutation = useMutation({
    mutationFn: (role_id: number) => adminService.assignRole(staffId, role_id),
    onSuccess: (_data, role_id) => {
      const assigned = allRoles.find((r) => r.role_id === role_id);
      if (assigned) setRoles((prev) => [...prev, assigned]);
      toast.success("Role assigned.");
      setAssignRoleId("");
    },
    onError: () => toast.error("Failed to assign role."),
  });

  const removeRoleMutation = useMutation({
    mutationFn: (role_id: number) => adminService.removeRole(staffId, role_id),
    onSuccess: (_data, role_id) => {
      setRoles((prev) => prev.filter((r) => r.role_id !== role_id));
      toast.success("Role removed.");
    },
    onError: () => toast.error("Failed to remove role."),
  });

  const togglingRole = assignRoleMutation.isPending
    ? Number(assignRoleId)
    : removeRoleMutation.isPending
      ? removeRoleMutation.variables
      : null;

  async function handleAssignRole(e: React.FormEvent) {
    e.preventDefault();
    if (!assignRoleId) return;
    assignRoleMutation.mutate(Number(assignRoleId));
  }

  async function handleRemoveRole(role_id: number) {
    removeRoleMutation.mutate(role_id);
  }

  const transferMutation = useMutation({
    mutationFn: () =>
      adminService.transferStaff(staffId, {
        store_id: Number(transferStoreId),
      }),
    onSuccess: async () => {
      toast.success("Staff transferred. History updated.");
      queryClient.invalidateQueries({ queryKey: ["staff-detail", staffId] });
      setTransferStoreId("");
    },
    onError: () => toast.error("Failed to transfer staff."),
  });
  const transferring = transferMutation.isPending;

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferStoreId) {
      toast.error("Select a store.");
      return;
    }
    transferMutation.mutate();
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  if (!staff)
    return <div className="p-8 text-slate-500">Staff member not found.</div>;

  const unassignedRoles = allRoles.filter(
    (r) => !roles.some((ar) => ar.role_id === r.role_id),
  );

  return (
    <div className="flex max-w-2xl flex-col gap-6 p-8">
      <button
        onClick={() => router.back()}
        className="self-start text-sm text-slate-500 hover:cursor-pointer hover:text-slate-800 hover:underline"
      >
        ← Back
      </button>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {staff.name}
          <span className="ml-2 text-base font-normal text-slate-400">
            #{staff.staff_id}
          </span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage this staff member&apos;s info, roles, work history, and store
          assignment.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition hover:cursor-pointer",
              tab === t.key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {/* Info tab */}
        {tab === "info" && (
          <form
            onSubmit={handleSaveInfo}
            className="flex flex-col gap-4 max-w-sm"
          >
            <Input
              variant="indigo"
              label="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <div className="text-sm text-slate-500">
              <p>Birth date: {staff.birth_date ?? "—"}</p>
              <p>Start date: {staff.start_time ?? "—"}</p>
            </div>
            <button
              type="submit"
              disabled={savingInfo}
              className="self-start rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:cursor-pointer hover:shadow-xl active:translate-y-0 active:shadow-lg disabled:pointer-events-none disabled:opacity-50"
            >
              {savingInfo ? "Saving…" : "Save"}
            </button>
          </form>
        )}

        {/* Roles tab */}
        {tab === "roles" && (
          <div className="flex flex-col gap-4">
            {/* Assigned roles */}
            {roles.length === 0 ? (
              <p className="text-sm text-slate-500">No roles assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <span
                    key={r.role_id}
                    className="flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1 text-sm text-white"
                  >
                    {r.name}
                    <button
                      onClick={() => handleRemoveRole(r.role_id)}
                      disabled={togglingRole === r.role_id}
                      className="opacity-60 hover:cursor-pointer hover:opacity-100"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Assign new role */}
            {unassignedRoles.length > 0 && (
              <form
                onSubmit={handleAssignRole}
                className="flex items-end gap-3"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    Add Role
                  </label>
                  <select
                    value={assignRoleId}
                    onChange={(e) => setAssignRoleId(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Choose role…</option>
                    {unassignedRoles.map((r) => (
                      <option key={r.role_id} value={r.role_id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={!assignRoleId}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:cursor-pointer hover:shadow-xl active:translate-y-0 active:shadow-lg disabled:pointer-events-none disabled:opacity-40"
                >
                  Assign
                </button>
              </form>
            )}
          </div>
        )}

        {/* History tab */}
        {tab === "history" && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            {history.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                No work history found.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Store ID</th>
                    <th className="px-4 py-3">Start</th>
                    <th className="px-4 py-3">End</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.history_id}>
                      <td className="px-4 py-3 text-slate-700">{h.store_id}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {String(h.start_date).split("T")[0]}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {h.end_date ? (
                          String(h.end_date).split("T")[0]
                        ) : (
                          <span className="font-medium text-emerald-600">
                            Current
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Transfer tab */}
        {tab === "transfer" && (
          <form
            onSubmit={handleTransfer}
            className="flex flex-col gap-4 max-w-sm"
          >
            <p className="text-sm text-slate-500">
              Transferring closes the current open history row and opens a new
              one for the selected store. This cannot be undone.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                New Store
              </label>
              <select
                value={transferStoreId}
                onChange={(e) => setTransferStoreId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              >
                <option value="">Select store…</option>
                {stores.map((s) => (
                  <option key={s.store_id} value={s.store_id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={transferring || !transferStoreId}
              className="self-start rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:cursor-pointer hover:shadow-xl active:translate-y-0 active:shadow-lg disabled:pointer-events-none disabled:opacity-50"
            >
              {transferring ? "Transferring…" : "Confirm Transfer"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
