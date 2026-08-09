"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/useCartStore";
import { useAuthModalStore } from "@/store/useAuthModalStore";
import LoginModal from "@/components/auth/LoginModal";
import RegisterModal from "@/components/auth/RegisterModal";
import ForgotPasswordModal from "@/components/auth/ForgotPasswordModal";
import UserMenu from "@/components/UserMenu";

export default function Header() {
  const router = useRouter();
  const cartItems = useCartStore((state) => state.items ?? []);
  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const [searchValue, setSearchValue] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const {
    loginOpen,
    registerOpen,
    forgotPasswordOpen,
    openLogin,
    openRegister,
    openForgotPassword,
    closeLogin,
    closeRegister,
    closeForgotPassword,
  } = useAuthModalStore();

  function submitSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = searchValue.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setMobileSearchOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          {/* Logo & Mobile Menu */}
          <div className="flex items-center gap-4">
            <button className="md:hidden">☰</button>
            <Link
              href="/"
              className="text-3xl font-black uppercase tracking-tighter text-black"
            >
              SMARTFIT
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 font-medium">
            <Link
              href="/category/all"
              className="flex items-center gap-1 text-black"
            >
              All Products
            </Link>
            <Link
              href="/categories"
              className="flex items-center gap-1 text-black"
            >
              Categories
            </Link>
            <Link href="/category/on-sale" className="text-black">
              On Sale
            </Link>
            <Link href="/category/new-arrivals" className="text-black">
              New Arrivals
            </Link>
            <Link href="/category/brands" className="text-black">
              Brands
            </Link>
          </nav>

          {/* Search & Icons */}
          <div className="flex items-center gap-4 flex-1 justify-end md:flex-none">
            <form
              onSubmit={submitSearch}
              className="hidden sm:flex items-center bg-[#F0F0F0] rounded-full px-4 py-2 w-full max-w-[300px] sm:w-[180px] md:w-[220px] lg:w-[300px]"
            >
              <button
                type="submit"
                aria-label="Search"
                className="text-gray-400 mr-2 shrink-0"
              >
                🔍
              </button>
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search for products..."
                className="bg-transparent outline-none w-full text-black placeholder-gray-400"
              />
            </form>
            <button
              type="button"
              aria-label="Search"
              onClick={() => setMobileSearchOpen((v) => !v)}
              className="sm:hidden text-xl"
            >
              🔍
            </button>
            <Link href="/cart" className="relative text-xl">
              🛒
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              )}
            </Link>
            <UserMenu onLoginClick={openLogin} onRegisterClick={openRegister} />
          </div>
        </div>

        {/* Mobile search — full-width row below the header bar, toggled by
            the icon above. Keeps the same submit/Enter behavior as desktop
            rather than being a second, separate implementation. */}
        {mobileSearchOpen && (
          <div className="sm:hidden border-t border-gray-100 px-4 py-3">
            <form
              onSubmit={submitSearch}
              className="flex items-center bg-[#F0F0F0] rounded-full px-4 py-2"
            >
              <button
                type="submit"
                aria-label="Search"
                className="text-gray-400 mr-2 shrink-0"
              >
                🔍
              </button>
              <input
                type="text"
                autoFocus
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search for products..."
                className="bg-transparent outline-none w-full text-black placeholder-gray-400"
              />
            </form>
          </div>
        )}
      </header>

      <LoginModal
        isOpen={loginOpen}
        onClose={closeLogin}
        onSwitchToRegister={openRegister}
        onSwitchToForgotPassword={openForgotPassword}
      />

      <RegisterModal
        isOpen={registerOpen}
        onClose={closeRegister}
        onSwitchToLogin={openLogin}
      />

      <ForgotPasswordModal
        isOpen={forgotPasswordOpen}
        onClose={closeForgotPassword}
        onSwitchToLogin={openLogin}
      />
    </>
  );
}
