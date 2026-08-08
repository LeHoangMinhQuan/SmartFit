"use client";

import AdminOnly from "@/components/staff/AdminOnly";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminOnly>{children}</AdminOnly>;
}
