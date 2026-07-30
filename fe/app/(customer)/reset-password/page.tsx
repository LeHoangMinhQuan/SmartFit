"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { confirmPasswordReset } from "@/services/auth.client.service";
import { useAuthModalStore } from "@/store/useAuthModalStore";
import Input from "@/components/ui/Input";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openForgotPassword = useAuthModalStore((s) => s.openForgotPassword);
  // Firebase's generatePasswordResetLink (with handleCodeInApp: true) sends
  // the user straight here with these in the query string — see
  // auth.service.ts#forgotPassword on the backend.
  const oobCode = searchParams.get("oobCode");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!oobCode) {
      setError(
        "This reset link is missing or malformed. Request a new one from the login screen.",
      );
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(oobCode, password);
      setDone(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ??
            "This reset link is invalid or has expired. Request a new one.",
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Choose a new password for your account.
          </p>
        </div>

        {done ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-gray-700">
              Your password has been reset. You can now log in with your new
              password.
            </p>
            <button
              onClick={() => router.push("/")}
              className="rounded-xl bg-black py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Go to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!oobCode && (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                This link doesn&apos;t look complete. Make sure you opened it
                directly from the reset email.
              </p>
            )}

            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              disabled={loading}
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />

            {error && (
              <p className="text-sm text-red-500 text-center -mt-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-xl bg-black py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Resetting…" : "Reset password"}
            </button>

            <button
              type="button"
              onClick={openForgotPassword}
              className="text-center text-sm text-gray-500 hover:underline"
            >
              Request a new link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
