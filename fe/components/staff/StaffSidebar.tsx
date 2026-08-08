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
  Truck,
  TicketPercent,
  Users,
  UserCog,
  Store,
  LogOut,
} from "lucide-react";
// adminOnly items mirror the backend's admin-only route groups in
// admin.routes.ts (Staff management, Roles, Stores, Vouchers, Discounts,
// Users are all authorize("admin") only there) — hiding them here is just
// UX (the API still gates it), so keep this list in sync with that file
// if the backend split ever changes.
const NAV_ITEMS = [
  {
    href: "/staff",
    label: "Dashboard",
    icon: LayoutDashboard,
    adminOnly: false,
  },
  {
    href: "/staff/products",
    label: "Products",
    icon: Package,
    adminOnly: false,
  },
  {
    href: "/staff/categories",
    label: "Categories",
    icon: FolderTree,
    adminOnly: false,
  },
  {
    href: "/staff/orders",
    label: "Orders",
    icon: ShoppingBag,
    adminOnly: false,
  },
  {
    href: "/staff/inventory",
    label: "Inventory",
    icon: Boxes,
    adminOnly: false,
  },
  {
    href: "/staff/suppliers",
    label: "Suppliers",
    icon: Truck,
    adminOnly: false,
  },
  {
    href: "/staff/vouchers",
    label: "Vouchers",
    icon: TicketPercent,
    adminOnly: true,
  },
  {
    href: "/staff/users",
    label: "Users",
    icon: Users,
    adminOnly: true,
  },
  {
    href: "/staff/staff",
    label: "Staffs",
    icon: UserCog,
    adminOnly: true,
  },
  {
    href: "/staff/stores",
    label: "Stores",
    icon: Store,
    adminOnly: true,
  },
];
export default function StaffSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { name, logout, isAdmin } = useStaffAuthStore();
  const admin = isAdmin();
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || admin);
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
        {visibleItems.map((item) => {
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
      <div className="border-t border-slate-200 px-2 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-red-500 transition-colors hover:cursor-pointer hover:bg-red-50"
        >
          <LogOut size={18} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
