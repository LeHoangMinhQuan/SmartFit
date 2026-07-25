"use client";

import { useState } from "react";
import {
  voucherService,
  type VoucherValidationResult,
} from "../../services/voucher.service";
import { formatPrice } from "../../lib/utils";
import Input from "../ui/Input";

interface VoucherInputProps {
  // Current cart subtotal — required by the backend to check the
  // minimum-order-amount rule and to compute the discount.
  orderAmount: number;
  applied: VoucherValidationResult | null;
  onApply: (voucher: VoucherValidationResult) => void;
  onRemove: () => void;
}

export default function VoucherInput({
  orderAmount,
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
      const voucher = await voucherService.validateVoucher(
        trimmed,
        orderAmount,
      );
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
    // The validate endpoint returns the discount already computed
    // server-side (discount_amount) — it doesn't send back value/
    // max_discount, so there's nothing to recompute here.
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 p-3">
        <div>
          <p className="text-sm font-medium text-green-700">{applied.code}</p>
          <p className="text-xs text-green-600">
            {applied.description ||
              `Save ${formatPrice(applied.discount_amount)}`}
          </p>
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
