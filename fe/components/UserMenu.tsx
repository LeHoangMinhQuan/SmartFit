"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/store/useAuthStore";
import { useChatUiStore } from "@/store/useChatUiStore";
import { logoutService } from "@/services/auth.client.service";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";

interface UserMenuProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

export default function UserMenu({
  onLoginClick,
  onRegisterClick,
}: UserMenuProps) {
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  // Still needed for handleLogout's nextAuthSignOut call below — Google
  // sign-in still creates a real NextAuth session alongside the backend
  // one now (see GoogleSessionBridge.tsx), and both need clearing.
  const { data: session } = useSession();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    setOpen(false);

    // 1. Clear the backend session (accessToken/refreshToken cookies +
    // the DB-side refresh token row). GoogleSessionBridge.tsx means
    // `user` is populated identically regardless of login method now, so
    // this always runs for anyone actually signed in — the clearAuth()
    // fallback only matters for the rare case where a NextAuth session
    // exists but the bridge sync hasn't resolved/succeeded yet.
    if (user) {
      await logoutService();
    } else {
      clearAuth();
    }

    // 2. Clear the NextAuth session itself (Google sign-in still creates
    // one alongside the backend session — see GoogleSessionBridge.tsx).
    if (session) {
      await nextAuthSignOut({ redirect: false });
    }

    // 3. Reset chat UI state — closes the panel and drops sessionId, so
    // the next open starts a fresh conversation rather than trying to
    // continue one tied to a session that's no longer authenticated.
    useChatUiStore.getState().reset();
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
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

            <span className="hidden max-w-[90px] truncate md:block">
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
                href="/profile"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-black transition-colors hover:bg-gray-50"
              >
                My Profile
              </Link>

              <Link
                href="/orders"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-black transition-colors hover:bg-gray-50"
              >
                My Orders
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
