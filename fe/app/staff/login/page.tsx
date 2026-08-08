"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import staffApi from "../../../lib/staffAxios";
import { useStaffAuthStore } from "../../../store/useStaffAuthStore";
import Input from "../../../components/ui/Input";

export default function StaffLoginPage() {
  const router = useRouter();
  const setAuth = useStaffAuthStore((s) => s.setAuth);

  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // POST /admin/auth/login — body: { staff_id, password }
      // Response payload carries { staff_id, name, roles, accessToken }.
      const { data } = await staffApi.post("/admin/auth/login", {
        staff_id: Number(staffId),
        password,
      });
      const extractedData = data.data; // Extract the actual data object from the response
      setAuth(
        extractedData.staff_id,
        extractedData.name,
        extractedData.accessToken,
        extractedData.roles ?? [],
      );
      router.push("/staff");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message ?? "Invalid staff ID or password");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-6 flex items-center gap-1 text-sm text-slate-500 transition hover:cursor-pointer hover:text-slate-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Back to home
        </button>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Staff Login</h1>
          <p className="mt-1 text-sm text-slate-500">Internal access only</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Staff ID"
            type="number"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            placeholder="e.g. 2"
            required
            disabled={loading}
          />

          <Input
            label="Password"
            type="password"
            passwordToggle
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          {error && (
            <p className="-mt-1 text-center text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-black py-3 text-sm font-medium text-white transition hover:cursor-pointer hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
