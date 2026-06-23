"use client";
import Link from "next/link";
import { useCartStore } from "@/store/useCartStore";
import { useState } from "react";
import LoginModal from "@/components/LoginModal";
import RegisterModal from "@/components/RegisterModal";
import UserMenu from "@/components/UserMenu";

export default function Header() {
  const cartItems = useCartStore((state) => state.items);
  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const openLogin = () => {
    setRegisterOpen(false);
    setLoginOpen(true);
  };
  const openRegister = () => {
    setLoginOpen(false);
    setRegisterOpen(true);
  };

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
              SHOP.CO
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 font-medium">
            <Link
              href="/category/all"
              className="flex items-center gap-1 text-black"
            >
              Shop
              <span className="text-xs text-black">▼</span>
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
            <div className="hidden lg:flex items-center bg-[#F0F0F0] rounded-full px-4 py-2 w-[400px]">
              <span className="text-gray-400 mr-2">🔍</span>
              <input
                type="text"
                placeholder="Search for products..."
                className="bg-transparent outline-none w-full text-black placeholder-gray-400"
              />
            </div>
            <button className="lg:hidden text-xl">🔍</button>
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
      </header>

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSwitchToRegister={openRegister}
      />
      <RegisterModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSwitchToLogin={openLogin}
      />
    </>
  );
}
