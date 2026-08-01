"use client";
import { useState } from "react";
import { useAuthModalStore } from "@/store/useAuthModalStore";
import { useAuthStore } from "@/store/useAuthStore";

export default function TopBanner() {
  const [isDismissed, setIsDismissed] = useState(false);
  const openRegister = useAuthModalStore((s) => s.openRegister);
  const openLogin = useAuthModalStore((s) => s.openLogin);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  // Don't render anything until we know the real auth state (avoids a
  // flash of the banner for logged-in users on first paint), and never
  // show it to a signed-in user — the offer is for new signups only.
  if (!hasHydrated || user || isDismissed) return null;

  return (
    <div className="bg-black text-white py-2 px-4 relative flex items-center justify-center text-xs md:text-sm">
      <p>
        Sign up and get 20% off to your first order.{" "}
        <button
          onClick={openRegister}
          className="font-medium underline hover:text-gray-300 transition-colors"
        >
          Sign Up Now
        </button>
        {" · Already have an account? "}
        <button
          onClick={openLogin}
          className="font-medium underline hover:text-gray-300 transition-colors"
        >
          Log In
        </button>
      </p>
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 hidden md:block"
        aria-label="Close banner"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
}