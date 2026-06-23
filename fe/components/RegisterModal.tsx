"use client";

import { useEffect, useCallback , useRef, useState } from "react";
import axios from "axios";
import Button from "@/components/Button";
import { useAuthStore } from "@/store/useAuthStore";

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

const initialForm = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  address: "",
};

export default function RegisterModal({
  isOpen,
  onClose,
  onSwitchToLogin,
}: RegisterModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const setAuth = useAuthStore((state) => state.setAuth);

  const [form, setForm] = useState(initialForm);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = useCallback(() => {
    setForm(initialForm);
    setAgreed(false);
    setError(null);
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { data } = await axios.post(
        "http://localhost:3000/api/auth/register",
        {
          username: form.username,
          email: form.email,
          password: form.password,
          phone: form.phone,
          address: form.address,
        },
      );

      // Auto-login: store auth state exactly like the login flow
      setAuth(data.user, data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);

      handleClose();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ??
            "Registration failed. Please try again.",
        );
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
        className="max-w-md w-full max-h-[90vh] overflow-y-auto space-y-6 p-8 border border-gray-200 rounded-3xl bg-white relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-modal-title"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition text-xl leading-none"
          aria-label="Close register modal"
        >
          ✕
        </button>

        <div className="text-center">
          <h2
            id="register-modal-title"
            className="text-3xl font-bold mb-2 text-black"
          >
            Create Account
          </h2>
          <p className="text-gray-500">Join SHOP.CO and start shopping</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              placeholder="jane_doe"
              value={form.username}
              onChange={set("username")}
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none text-black"
              required
              disabled={loading}
              minLength={2}
              maxLength={50}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="jane@example.com"
              value={form.email}
              onChange={set("email")}
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none text-black"
              required
              disabled={loading}
              maxLength={50}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="0901234567"
              value={form.phone}
              onChange={set("phone")}
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none text-black"
              required
              disabled={loading}
              minLength={10}
              maxLength={10}
              pattern="\d{10}"
              title="Phone must be exactly 10 digits"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              placeholder="123 Le Loi, Q1, HCMC"
              value={form.address}
              onChange={set("address")}
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none text-black"
              required
              disabled={loading}
              maxLength={70}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="Create a strong password"
              value={form.password}
              onChange={set("password")}
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none text-black"
              required
              disabled={loading}
              minLength={8}
              maxLength={72}
            />
            <div className="text-xs text-gray-400 mt-2 space-y-1">
              <p>• At least 8 characters</p>
              <p>• Upper &amp; lowercase letters</p>
              <p>• At least one number</p>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="Confirm your password"
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none text-black"
              required
              disabled={loading}
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          {/* Terms */}
          <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-500">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 rounded border-gray-300 accent-black"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
            />
            <span>
              I agree to the{" "}
              <a href="#" className="font-bold text-black hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="font-bold text-black hover:underline">
                Privacy Policy
              </a>
            </span>
          </label>

          <Button
            label={loading ? "Creating account…" : "Create Account"}
            variant="primary"
            className="w-full mt-6"
            type="submit"
            disabled={loading || !agreed}
          />
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <button
            onClick={onSwitchToLogin}
            className="font-bold text-black hover:underline"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
