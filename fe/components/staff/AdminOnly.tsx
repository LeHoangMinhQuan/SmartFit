"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffAuthStore } from "../../store/useStaffAuthStore";
import Spinner from "../ui/Spinner";

/**
 * Wraps an admin-only staff page. The staff layout already guarantees
 * hasHydrated + a valid accessToken by the time any page renders (see
 * app/staff/layout.tsx), so this only needs to check the role.
 *
 * A staff-role account landing directly on an admin-only URL (e.g. typing
 * /staff/vouchers) gets redirected to the dashboard rather than shown a
 * standalone "not authorized" page — simpler for a demo-scale app, and
 * consistent with the sidebar already hiding these links rather than
 * greying them out. The API's own authorize("admin") is still the real
 * enforcement; this is just UX so staff don't hit a page that renders and
 * then 403s on every request it fires.
 */
export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAdmin = useStaffAuthStore((s) => s.isAdmin);
  const roles = useStaffAuthStore((s) => s.roles);
  const admin = isAdmin();

  useEffect(() => {
    if (!admin) router.replace("/staff");
  }, [admin, router]);

  if (!admin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
