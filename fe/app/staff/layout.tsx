"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStaffAuthStore } from "../../store/useStaffAuthStore";
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
  const accessToken = useStaffAuthStore((s) => s.accessToken);
  const [checked, setChecked] = useState(false);

  const isLoginPage = pathname === "/staff/login";

  useEffect(() => {
    if (isLoginPage) {
      setChecked(true);
      return;
    }
    if (!accessToken) {
      router.replace("/staff/login");
      return;
    }
    setChecked(true);
  }, [accessToken, isLoginPage, router]);

  // /staff/login renders standalone — no sidebar, no auth gate
  if (isLoginPage) return <>{children}</>;

  // Gate: don't flash protected content before the redirect fires
  if (!checked || !accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <StaffSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <Toaster />
    </div>
  );
}
