"use client";

import Image from "next/image";
import { useAuthStore } from "@/store/useAuthStore";
import { logoutService } from "@/services/auth.client.service";

interface UserMenuProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export default function UserMenu({
  onLoginClick,
  onRegisterClick,
}: UserMenuProps) {
  const user = useAuthStore((state) => state.user);

  const handleLogout = async () => {
    await logoutService();
  };

  return (
    <div className="relative group">
      {/* ── Trigger ────────────────────────────────────────────────────── */}
      {user ? (
        <button className="flex items-center gap-2 text-sm font-medium text-black">
          {user.avatar_url ? (
            <Image
              src={user.avatar_url}
              alt={user.username}
              width={32}
              height={32}
              className="rounded-full object-cover w-8 h-8"
            />
          ) : (
            <span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-sm font-bold uppercase select-none">
              {user.username.charAt(0)}
            </span>
          )}
          <span className="hidden md:block max-w-[120px] truncate">
            {user.username}
          </span>
        </button>
      ) : (
        <button className="text-xl leading-none">👤</button>
      )}

      {/* ── Dropdown ───────────────────────────────────────────────────── */}
      <div className="absolute right-0 top-full pt-2 w-44 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg py-1 overflow-hidden">
          {user ? (
            <>
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs text-gray-400">Signed in as</p>
                <p className="text-sm font-medium text-black truncate">
                  {user.email}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onLoginClick}
                className="w-full text-left px-4 py-2.5 text-sm text-black hover:bg-gray-50 transition-colors font-medium"
              >
                Sign in
              </button>
              <button
                onClick={onRegisterClick}
                className="w-full text-left px-4 py-2.5 text-sm text-black hover:bg-gray-50 transition-colors"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
