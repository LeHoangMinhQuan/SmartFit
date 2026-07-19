"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useStaffAuthStore } from "../../store/useStaffAuthStore";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Boxes,
  TicketPercent,
  Users,
  UserCog,
  Store,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/staff",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/staff/products",
    label: "Products",
    icon: Package,
  },
  {
    href: "/staff/categories",
    label: "Categories",
    icon: FolderTree,
  },
  {
    href: "/staff/orders",
    label: "Orders",
    icon: ShoppingBag,
  },
  {
    href: "/staff/inventory",
    label: "Inventory",
    icon: Boxes,
  },
  {
    href: "/staff/vouchers",
    label: "Vouchers",
    icon: TicketPercent,
  },
  {
    href: "/staff/users",
    label: "Users",
    icon: Users,
  },
  {
    href: "/staff/staff",
    label: "Staffs",
    icon: UserCog,
  },
  {
    href: "/staff/stores",
    label: "Stores",
    icon: Store,
  },
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
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white/80 backdrop-blur-xl shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 font-bold text-white shadow-lg">
            SF
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">SmartFit Admin</h2>
            <p className="text-sm text-slate-500">{name ?? "Administrator"}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/staff"
              ? pathname === "/staff"
              : pathname.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "group mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon
                size={18}
                className={clsx(
                  "transition-colors",
                  active
                    ? "text-white"
                    : "text-slate-500 group-hover:text-slate-700",
                )}
              />

              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-2 py-4">
        <button
          onClick={handleLogout}
          className="block bg-red-100 w-full rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 hover:cursor-pointer"
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}
