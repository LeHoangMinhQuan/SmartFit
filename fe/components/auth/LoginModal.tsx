"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import Image from "next/image";
import axios from "axios";
import Button from "@/components/ui/Button";
import { useAuthStore } from "@/store/useAuthStore";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
}

const initialState = {
  email: "",
  password: "",
};

export default function LoginModal({
  isOpen,
  onClose,
  onSwitchToRegister,
}: LoginModalProps) {
  const BASE_URL = process.env.BASE_URL;

  const dialogRef = useRef<HTMLDivElement>(null);
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState(initialState.email);
  const [password, setPassword] = useState(initialState.password);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = useCallback(() => {
    setEmail(initialState.email);
    setPassword(initialState.password);
    setError(null);
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data } = await axios.post(
        `${BASE_URL}/auth/login`,
        { email, password },
      );

      setAuth(data.user, data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      handleClose();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? "Invalid email or password");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-12 backdrop-blur-sm bg-black/40"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        className="max-w-md w-full space-y-8 p-8 border border-gray-200 rounded-3xl bg-white relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition text-xl leading-none"
          aria-label="Close login modal"
        >
          ✕
        </button>

        <div className="text-center">
          <h2
            id="login-modal-title"
            className="text-3xl font-bold mb-2 text-black"
          >
            Welcome Back
          </h2>
          <p className="text-gray-500">Sign in to your SHOP.CO account</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none text-black"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none text-black"
                required
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center -mt-2">{error}</p>
          )}

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer text-gray-500">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 accent-black"
              />
              Remember me
            </label>
            <a href="#" className="font-medium hover:text-gray-700 text-black">
              Forgot password?
            </a>
          </div>

          <Button
            label={loading ? "Signing in…" : "Sign In"}
            variant="primary"
            className="w-full mt-6"
            type="submit"
            disabled={loading}
          />
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Or continue with
              </span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <button
              type="button"
              className="border border-gray-200 py-3 rounded-xl flex justify-center hover:bg-gray-50 transition"
            >
              <Image
                src="/images/google.svg"
                alt="Google"
                width={32}
                height={32}
              />
            </button>
            <button
              type="button"
              className="border border-gray-200 py-3 rounded-xl flex justify-center hover:bg-gray-50 transition"
            >
              <Image
                src="/images/facebook.svg"
                alt="Facebook"
                width={32}
                height={32}
              />
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          Don&apos;t have an account?{" "}
          <button
            onClick={onSwitchToRegister}
            className="font-bold text-black hover:underline"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
