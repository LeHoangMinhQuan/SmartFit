"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import { requestPasswordReset } from "@/services/auth.client.service";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  onSwitchToLogin,
}: ForgotPasswordModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const resetForm = useCallback(() => {
    setEmail("");
    setError(null);
    setSubmitted(false);
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

  const forgotPasswordMutation = useMutation({
    mutationFn: () => requestPasswordReset(email),
    onSuccess: () => setSubmitted(true),
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ??
            "Something went wrong. Please try again.",
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    },
  });
  const loading = forgotPasswordMutation.isPending;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    forgotPasswordMutation.mutate();
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
        aria-labelledby="forgot-password-modal-title"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition text-xl leading-none"
          aria-label="Close forgot password modal"
        >
          ✕
        </button>

        <div className="text-center">
          <h2
            id="forgot-password-modal-title"
            className="text-3xl font-bold mb-2 text-black"
          >
            Forgot Password
          </h2>
          <p className="text-gray-500">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-6 text-center">
            <p className="text-sm text-gray-700">
              If an account exists for <strong>{email}</strong>, a password
              reset link has been sent. Check your inbox (and spam folder).
            </p>
            <Button
              label="Back to login"
              variant="primary"
              className="w-full"
              onClick={onSwitchToLogin}
            />
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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

            {error && (
              <p className="text-sm text-red-500 text-center -mt-2">{error}</p>
            )}

            <Button
              label={loading ? "Sending…" : "Send reset link"}
              variant="primary"
              className="w-full"
              type="submit"
              disabled={loading}
            />

            <p className="text-center text-sm text-gray-500">
              Remembered your password?{" "}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-bold text-black hover:underline"
              >
                Back to login
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
