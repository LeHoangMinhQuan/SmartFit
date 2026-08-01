"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orderService } from "../../../services/order.service";
import Spinner from "../../../components/ui/Spinner";
import { Check, X, ShieldCheck, AlertCircle } from "lucide-react";

// VNPay response codes — '00' = success, everything else = failure
// Full code list: https://sandbox.vnpayment.vn/apis/docs/bang-ma-loi/
const SUCCESS_CODE = "00";

// Bug fix: this used to be a single fetch after a fixed 2s delay
// ("Poll the real order status" was aspirational, not actual — there was
// no refetchInterval). If VNPay's IPN callback took longer than 2s to
// land (routing latency, retries, etc.), the page would permanently show
// "pending_payment" with no way to recover short of a manual refresh.
// Now actually polls every 2.5s, capped at MAX_POLL_ATTEMPTS (~40s total)
// so a genuinely missing IPN (e.g. the callback URL isn't reachable from
// VNPay's servers) doesn't poll forever.
const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 16;

interface Props {
  responseCode: string;
  vnpTxnRef: string;
  orderId: number;
}

// Helper to color-code order statuses dynamically
function getStatusBadgeClasses(status: string) {
  const normalized = status.toLowerCase();
  if (
    normalized.includes("paid") ||
    normalized.includes("completed") ||
    normalized.includes("success")
  ) {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
  if (normalized.includes("pending") || normalized.includes("processing")) {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }
  if (normalized.includes("failed") || normalized.includes("cancelled")) {
    return "bg-rose-100 text-rose-700 border-rose-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function PaymentResultPage({
  responseCode,
  vnpTxnRef,
  orderId,
}: Props) {
  const router = useRouter();

  const isSuccess = responseCode === SUCCESS_CODE;

  // Small initial delay before the first check, same as before — gives
  // IPN a head start before we even look.
  const [delayElapsed, setDelayElapsed] = useState(false);
  useEffect(() => {
    if (!isSuccess || !orderId) return;
    const timer = setTimeout(() => setDelayElapsed(true), 2000);
    return () => clearTimeout(timer);
  }, [isSuccess, orderId]);

  const pollAttemptsRef = useRef(0);

  const orderStatusQuery = useQuery({
    queryKey: ["payment-result-order", orderId],
    queryFn: () => orderService.getOrder(Number(orderId)),
    enabled: isSuccess && !!orderId && delayElapsed,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const isTerminal = Boolean(status) && status !== "pending_payment";
      if (isTerminal) return false;
      pollAttemptsRef.current += 1;
      return pollAttemptsRef.current < MAX_POLL_ATTEMPTS
        ? POLL_INTERVAL_MS
        : false;
    },
  });

  const orderStatus = orderStatusQuery.data?.status ?? null;
  const stillPending = orderStatus === "pending_payment";
  const pollingTimedOut =
    stillPending && pollAttemptsRef.current >= MAX_POLL_ATTEMPTS;
  const polling =
    isSuccess &&
    !!orderId &&
    (!delayElapsed || orderStatusQuery.isFetching) &&
    !pollingTimedOut;

  if (polling) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 py-10">
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-5 rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm animate-in fade-in duration-500">
          <div className="relative flex items-center justify-center">
            <ShieldCheck className="absolute h-8 w-8 text-indigo-400 animate-pulse" />
            <Spinner size="lg" className="text-indigo-600 opacity-30" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-900">
              Verifying Payment
            </h2>
            <p className="text-sm font-medium text-slate-500">
              Please wait while we securely confirm your transaction...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 py-10 px-4">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm animate-in zoom-in-95 duration-500 sm:px-10">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50">
            <Check className="h-10 w-10 text-emerald-500" strokeWidth={3} />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Payment Successful!
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Thank you for your purchase. We've received your order and are
            getting it ready.
          </p>

          {/* Receipt Details Card */}
          <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-200/60 py-3 first:pt-0 last:border-0 last:pb-0">
              <span className="font-medium text-slate-500">Order ID</span>
              <span className="font-bold text-slate-900">#{orderId}</span>
            </div>
            {vnpTxnRef && (
              <div className="flex items-center justify-between border-b border-slate-200/60 py-3 first:pt-0 last:border-0 last:pb-0">
                <span className="font-medium text-slate-500">
                  Transaction Ref
                </span>
                <span className="font-mono font-medium text-slate-700">
                  {vnpTxnRef}
                </span>
              </div>
            )}
            {orderStatus && (
              <div className="flex items-center justify-between border-b border-slate-200/60 py-3 first:pt-0 last:border-0 last:pb-0">
                <span className="font-medium text-slate-500">Order Status</span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold capitalize ${getStatusBadgeClasses(orderStatus)}`}
                >
                  {orderStatus}
                </span>
              </div>
            )}
          </div>

          {pollingTimedOut && (
            <p className="mt-4 text-xs text-slate-500">
              Your payment is still being confirmed — this can take a moment
              longer than usual. Check your{" "}
              <button
                onClick={() => router.push("/orders")}
                className="font-medium underline hover:text-slate-700"
              >
                orders page
              </button>{" "}
              shortly for the latest status.
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {orderId && (
              <button
                onClick={() => router.push(`/orders/${orderId}`)}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30"
              >
                View Order
              </button>
            )}
            <button
              onClick={() => router.push("/")}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Failure State
  const errorMap: Record<string, string> = {
    "07": "Transaction flagged for suspected fraud.",
    "09": "Card/account not registered for internet banking.",
    "10": "Incorrect card details entered 3 times.",
    "11": "Payment session expired.",
    "12": "Card/account is locked.",
    "13": "OTP entered incorrectly.",
    "24": "Transaction cancelled by customer.",
    "51": "Insufficient account balance.",
    "65": "Daily transaction limit exceeded.",
    "75": "Bank is under maintenance.",
    "79": "Payment password entered incorrectly too many times.",
  };

  const errorMsg =
    (responseCode && errorMap[responseCode]) ??
    "Payment was not completed. Please try again.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-10 px-4">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm animate-in zoom-in-95 duration-500 sm:px-10">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 ring-8 ring-rose-50/50">
          <X className="h-10 w-10 text-rose-500" strokeWidth={3} />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Payment Failed
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          We couldn't process your payment at this time. No charges have been
          made.
        </p>

        {/* Error Details Alert */}
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-center">
          <AlertCircle className="h-5 w-5 text-rose-500" />
          <p className="text-sm font-medium text-rose-800">{errorMsg}</p>
          {responseCode && (
            <p className="mt-1 font-mono text-xs font-semibold text-rose-400">
              Error Code: {responseCode}
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => router.push("/checkout")}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30"
          >
            Try Again
          </button>
          <button
            onClick={() => router.push("/orders")}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            My Orders
          </button>
        </div>
      </div>
    </div>
  );
}
