"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
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

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setOpen(false);
    await logoutService();
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 text-sm font-medium text-black"
      >
        {user ? (
          <>
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt={user.username}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 select-none items-center justify-center rounded-full bg-black text-sm font-bold uppercase text-white">
                {user.username.charAt(0)}
              </span>
            )}

            <span className="hidden max-w-[120px] truncate md:block">
              {user.username}
            </span>
          </>
        ) : (
          <span className="text-xl leading-none">👤</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-gray-200 bg-white py-1 shadow-lg">
          {user ? (
            <>
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-400">Signed in as</p>
                <p className="truncate text-sm font-medium text-black">
                  {user.email}
                </p>
              </div>

              <Link
                href="/staff/login"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-black"
              >
                🛡️ Staff Login
              </Link>

              <div className="my-1 border-t border-gray-100" />

              <button
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left text-sm text-red-500 transition-colors hover:bg-gray-50"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setOpen(false);
                  onLoginClick();
                }}
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-black transition-colors hover:bg-gray-50"
              >
                Sign in
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  onRegisterClick();
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-black transition-colors hover:bg-gray-50"
              >
                Sign up
              </button>

              <div className="my-1 border-t border-gray-100" />

              <Link
                href="/staff/login"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-black"
              >
                🛡️ Staff Login
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
