"use client";

import { useState } from "react";
import { voucherService } from "../../services/voucher.service";
import { formatPrice } from "../../lib/utils";
import Input from "../ui/Input";
import type { Voucher } from "../../interfaces";

interface VoucherInputProps {
  applied: Voucher | null;
  onApply: (voucher: Voucher) => void;
  onRemove: () => void;
}

export default function VoucherInput({
  applied,
  onApply,
  onRemove,
}: VoucherInputProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const voucher = await voucherService.validateVoucher(trimmed);
      onApply(voucher);
      setCode("");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Invalid or expired voucher.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (applied) {
    const saving =
      applied.type === "percent"
        ? `${applied.value}% off (max ${formatPrice(applied.max_discount)})`
        : `${formatPrice(applied.value)} off`;

    return (
      <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 p-3">
        <div>
          <p className="text-sm font-medium text-green-700">{applied.code}</p>
          <p className="text-xs text-green-600">{saving}</p>
        </div>
        <button
          onClick={onRemove}
          className="text-xs text-gray-500 hover:text-red-500"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Voucher code"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError("");
        }}
        error={error}
        onKeyDown={(e) => e.key === "Enter" && handleApply()}
        className="flex-1"
      />
      <button
        onClick={handleApply}
        disabled={loading || !code.trim()}
        className="self-start rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
      >
        {loading ? "…" : "Apply"}
      </button>
    </div>
  );
}
