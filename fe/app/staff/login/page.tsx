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
      // Response payload carries { staff_id, name, accessToken } per the staff JWT shape.
      const { data } = await staffApi.post("/admin/auth/login", {
        staff_id: Number(staffId),
        password,
      });
      const extractedData = data.data; // Extract the actual data object from the response
      setAuth(extractedData.staff_id, extractedData.name, extractedData.accessToken);
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Staff Login</h1>
          <p className="mt-1 text-sm text-gray-500">Internal access only</p>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
