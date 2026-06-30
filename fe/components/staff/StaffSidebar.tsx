"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useStaffAuthStore } from "../../store/useStaffAuthStore";

const NAV_ITEMS = [
  { href: "/staff", label: "Dashboard" },
  { href: "/staff/products", label: "Products" },
  { href: "/staff/categories", label: "Categories" },
  { href: "/staff/orders", label: "Orders" },
  { href: "/staff/inventory", label: "Inventory" },
  { href: "/staff/vouchers", label: "Vouchers" },
  { href: "/staff/users", label: "Users" },
  { href: "/staff/staff", label: "Staff" },
  { href: "/staff/stores", label: "Stores" },
];

export default function StaffSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { name, logout } = useStaffAuthStore();

  function handleLogout() {
    logout();
    router.push("/staff/login");
  }

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b px-5 py-5">
        <p className="text-sm font-semibold text-gray-900">Staff Panel</p>
        {name && <p className="mt-0.5 text-xs text-gray-500">{name}</p>}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV_ITEMS.map((item) => {
          // Exact match for dashboard root; prefix match for nested routes
          const active =
            item.href === "/staff"
              ? pathname === "/staff"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "block rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-black text-white"
                  : "text-gray-600 hover:bg-gray-100",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-2 py-4">
        <button
          onClick={handleLogout}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}
