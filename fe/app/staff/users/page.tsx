"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { adminService } from "../../../services/staff/admin.service";
import { formatDate } from "../../../lib/utils";
import DataTable from "../../../components/staff/DataTable";

export default function StaffUsersPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["staff-users", page],
    queryFn: () => adminService.getAllUsers({ page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const users = data?.data ?? [];
  const meta = data?.meta ?? null;

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
