"use client";

import { useEffect, useState } from "react";
import { adminService } from "../../../services/staff/admin.service";
import { formatDate } from "../../../lib/utils";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import type { PaginationMeta, User } from "../../../interfaces";

export default function StaffUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminService
      .getAllUsers({ page, limit: 20 })
      .then((res) => {
        setUsers(res.data);
        setMeta(res.meta);
      })
      .catch(() => toast.error("Failed to load users."))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          View registered customers and their account details.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <DataTable
          columns={[
            { key: "user_id", header: "ID", className: "w-16" },
            { key: "username", header: "Username" },
            { key: "email", header: "Email" },
            { key: "phone", header: "Phone" },
            {
              key: "created_at",
              header: "Joined",
              render: (r) => formatDate(r.created_at as string),
            },
          ]}
          rows={users as unknown as Record<string, unknown>[]}
          rowKey={(r) => r.user_id as number}
          loading={loading}
          meta={meta ?? undefined}
          onPageChange={setPage}
          emptyMessage="No users found."
        />
      </div>
    </div>
  );
}
