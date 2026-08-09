"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  voucherService,
  type VoucherValidationResult,
} from "../../services/voucher.service";
import { formatPrice, formatDate } from "../../lib/utils";
import Input from "../ui/Input";
import Spinner from "../ui/Spinner";

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
  const [browsing, setBrowsing] = useState(false);
  const [selectingCode, setSelectingCode] = useState<string | null>(null);

  const availableQuery = useQuery({
    queryKey: ["available-vouchers", orderAmount],
    queryFn: () => voucherService.getAvailableVouchers(orderAmount),
    enabled: browsing,
  });
  const vouchers = availableQuery.data ?? [];

  async function handleApply(codeOverride?: string) {
    const trimmed = (codeOverride ?? code).trim();
    if (!trimmed) return;
    // Distinguish "applying from the typed input" vs. "applying a card
    // picked from the browse list" so only the relevant control shows a
    // loading state instead of both at once.
    if (codeOverride) setSelectingCode(codeOverride);
    else setLoading(true);
    setError("");
    try {
      const voucher = await voucherService.validateVoucher(
        trimmed,
        orderAmount,
      );
      onApply(voucher);
      setCode("");
      setBrowsing(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Invalid or expired voucher.";
      setError(msg);
    } finally {
      setLoading(false);
      setSelectingCode(null);
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
    <div className="flex flex-col gap-3">
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
          onClick={() => handleApply()}
          disabled={loading || !code.trim()}
          className="self-start text-indigo-500 rounded-lg border border-indigo-500 px-4 py-2 text-sm hover:bg-gray-50 hover:cursor-pointer disabled:opacity-40"
        >
          {loading ? "…" : "Apply"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setBrowsing(true)}
        className="self-start text-xs font-medium text-indigo-500 hover:text-indigo-600 hover:underline"
      >
        View available vouchers
      </button>

      {browsing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-12 backdrop-blur-sm"
          onClick={() => setBrowsing(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Available Vouchers
              </h3>
              <button
                onClick={() => setBrowsing(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {availableQuery.isLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner size="md" />
                </div>
              ) : vouchers.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No vouchers available right now.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {vouchers.map((v) => {
                    // eligible is null when orderAmount wasn't sent (not
                    // the case here, since checkout always has a
                    // subtotal) — treated as "unknown, don't block".
                    const ineligible = v.eligible === false;
                    const disabled =
                      ineligible || v.already_used || selectingCode !== null;
                    return (
                      <div
                        key={v.voucher_id}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                          ineligible || v.already_used
                            ? "border-slate-100 bg-slate-50 opacity-60"
                            : "border-indigo-100 bg-indigo-50/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {v.code}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {v.description ||
                              (v.type === "percent"
                                ? `${v.value}% off, up to ${formatPrice(v.max_discount)}`
                                : `${formatPrice(v.value)} off`)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {v.already_used
                              ? "Already used"
                              : ineligible
                                ? `Min. order ${formatPrice(v.min_amount)}`
                                : `Valid until ${formatDate(v.end_date)}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleApply(v.code)}
                          disabled={disabled}
                          className="shrink-0 rounded-lg border border-indigo-500 px-3 py-1.5 text-xs font-medium text-indigo-500 hover:bg-indigo-50 hover:cursor-pointer disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                        >
                          {selectingCode === v.code ? "…" : "Select"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
