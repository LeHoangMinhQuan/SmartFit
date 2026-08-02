"use client";

import { useRouter } from "next/navigation";
import { CreditCard, AlertTriangle } from "lucide-react";

interface ChatCheckoutRedirectProps {
  checkoutUrl: string;
  warnings: string[];
}

/**
 * Rendered off a completed tool-prepare_checkout part. Nothing has been
 * charged or placed yet — checkoutUrl just carries the customer's stated
 * preferences (payment method, voucher, default address) as query params
 * for the /checkout page (app/(customer)/checkout/page.tsx) to read and
 * pre-select on load. Any warnings (invalid voucher, no default address on
 * file, etc.) are surfaced here too, since they mean the corresponding
 * preference silently wasn't applied.
 */
export default function ChatCheckoutRedirect({
  checkoutUrl,
  warnings,
}: ChatCheckoutRedirectProps) {
  const router = useRouter();

  return (
    <div className="space-y-1.5">
      {warnings.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-1.5 text-xs text-amber-600"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{w}</span>
        </div>
      ))}
      <button
        onClick={() => router.push(checkoutUrl)}
        className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
      >
        <CreditCard size={16} />
        Go to checkout
      </button>
    </div>
  );
}
