"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStaffAuthStore } from "../../store/useStaffAuthStore";
import { refreshStaffAccessToken } from "../../lib/staffAxios";
import StaffSidebar from "@/components/staff/StaffSidebar";
import Spinner from "../../components/ui/Spinner";
import { Toaster } from "../../components/ui/Toast";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const staffId = useStaffAuthStore((s) => s.staffId);
  const accessToken = useStaffAuthStore((s) => s.accessToken);
  const hasHydrated = useStaffAuthStore((s) => s.hasHydrated);
  const logout = useStaffAuthStore((s) => s.logout);
  const [checked, setChecked] = useState(false);

  const isLoginPage = pathname === "/staff/login";

  useEffect(() => {
    if (isLoginPage) {
      setChecked(true);
      return;
    }

    // Wait for the persisted store to finish loading from localStorage.
    // Before this, staffId is always null — deciding anything here would
    // be racing against hydration, which is exactly what caused the
    // reload-redirects-anyway bug.
    if (!hasHydrated) return;

    if (!staffId) {
      router.replace("/staff/login");
      return;
    }

    if (!accessToken) {
      refreshStaffAccessToken()
        .then(() => setChecked(true))
        .catch(() => {
          logout();
          router.replace("/staff/login");
        });
      return;
    }

    setChecked(true);
  }, [hasHydrated, staffId, accessToken, isLoginPage, router, logout]);

  if (isLoginPage) return <>{children}</>;

  if (!checked || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <StaffSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <Toaster />
    </div>
  );
}
