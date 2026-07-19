"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { adminService } from "../../../../services/staff/admin.service";
import { toast } from "../../../../components/ui/Toast";
import Spinner from "../../../../components/ui/Spinner";
import Input from "../../../../components/ui/Input";
import type { Role, Staff, Store } from "../../../../interfaces";

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
  const params = useParams<{ staff_id: string }>();

  const staffId = Number(params.staff_id);

  const [tab, setTab] = useState<Tab>("info");

  const [staff, setStaff] = useState<Staff | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [history, setHistory] = useState<StaffHistory[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit info state
  const [editName, setEditName] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  // Transfer state
  const [transferStoreId, setTransferStoreId] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Role assign state
  const [assignRoleId, setAssignRoleId] = useState("");
  const [togglingRole, setTogglingRole] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminService.getStaff(staffId),
      adminService.getRoles(),
      adminService.getStaffHistory(staffId),
      adminService.getStores(),
    ])
      .then(([s, allR, hist, storeList]) => {
        setStaff(s);
        setEditName(s.name);
        setAllRoles(allR);
        setHistory(hist);
        setStores(storeList);
        console.log("Staff detail loaded:", s, allR, hist, storeList);
      })
      .catch(() => toast.error("Failed to load staff detail."))
      .finally(() => setLoading(false));
  }, [staffId]);

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingInfo(true);
    try {
      await adminService.updateStaff(staffId, { name: editName });
      setStaff((prev) => (prev ? { ...prev, name: editName } : prev));
      toast.success("Staff info updated.");
    } catch {
      toast.error("Failed to update staff info.");
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleAssignRole(e: React.FormEvent) {
    e.preventDefault();
    if (!assignRoleId) return;
    const role_id = Number(assignRoleId);
    setTogglingRole(role_id);
    try {
      await adminService.assignRole(staffId, role_id);
      const assigned = allRoles.find((r) => r.role_id === role_id);
      if (assigned) setRoles((prev) => [...prev, assigned]);
      toast.success("Role assigned.");
      setAssignRoleId("");
    } catch {
      toast.error("Failed to assign role.");
    } finally {
      setTogglingRole(null);
    }
  }

  async function handleRemoveRole(role_id: number) {
    setTogglingRole(role_id);
    try {
      await adminService.removeRole(staffId, role_id);
      setRoles((prev) => prev.filter((r) => r.role_id !== role_id));
      toast.success("Role removed.");
    } catch {
      toast.error("Failed to remove role.");
    } finally {
      setTogglingRole(null);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferStoreId) {
      toast.error("Select a store.");
      return;
    }
    setTransferring(true);
    try {
      await adminService.transferStaff(staffId, {
        store_id: Number(transferStoreId),
      });
      toast.success("Staff transferred. History updated.");
      // Refresh history
      const hist = await adminService.getStaffHistory(staffId);
      setHistory(hist);
      setTransferStoreId("");
    } catch {
      toast.error("Failed to transfer staff.");
    } finally {
      setTransferring(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  if (!staff)
    return <div className="p-8 text-gray-500">Staff member not found.</div>;

  const unassignedRoles = allRoles.filter(
    (r) => !roles.some((ar) => ar.role_id === r.role_id),
  );

  return (
    <div className="p-8 flex flex-col gap-6 max-w-2xl">
      <button
        onClick={() => router.back()}
        className="self-start text-sm text-gray-400 hover:underline"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-bold">
        {staff.name}
        <span className="ml-2 text-sm font-normal text-gray-400">
          #{staff.staff_id}
        </span>
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition",
              tab === t.key
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Info tab */}
      {tab === "info" && (
        <form
          onSubmit={handleSaveInfo}
          className="flex flex-col gap-4 max-w-sm"
        >
          <Input
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <div className="text-sm text-gray-500">
            <p>Birth date: {staff.birth_date ?? "—"}</p>
            <p>Start date: {staff.start_time ?? "—"}</p>
          </div>
          <button
            type="submit"
            disabled={savingInfo}
            className="self-start rounded-lg bg-black px-5 py-2 text-sm text-white disabled:opacity-50"
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
            <p className="text-sm text-gray-500">No roles assigned.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <span
                  key={r.role_id}
                  className="flex items-center gap-2 rounded-full bg-black px-3 py-1 text-sm text-white"
                >
                  {r.name}
                  <button
                    onClick={() => handleRemoveRole(r.role_id)}
                    disabled={togglingRole === r.role_id}
                    className="opacity-60 hover:opacity-100"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Assign new role */}
          {unassignedRoles.length > 0 && (
            <form onSubmit={handleAssignRole} className="flex items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Add Role
                </label>
                <select
                  value={assignRoleId}
                  onChange={(e) => setAssignRoleId(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
                className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                Assign
              </button>
            </form>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="rounded-xl border">
          {history.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">
              No work history found.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-4 py-3">Store ID</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((h) => (
                  <tr key={h.history_id}>
                    <td className="px-4 py-3">{h.store_id}</td>
                    <td className="px-4 py-3">
                      {String(h.start_date).split("T")[0]}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {h.end_date ? (
                        String(h.end_date).split("T")[0]
                      ) : (
                        <span className="font-medium text-green-600">
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
          <p className="text-sm text-gray-500">
            Transferring closes the current open history row and opens a new one
            for the selected store. This cannot be undone.
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              New Store
            </label>
            <select
              value={transferStoreId}
              onChange={(e) => setTransferStoreId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
            className="self-start rounded-lg bg-black px-5 py-2 text-sm text-white disabled:opacity-50"
          >
            {transferring ? "Transferring…" : "Confirm Transfer"}
          </button>
        </form>
      )}
    </div>
  );
}
