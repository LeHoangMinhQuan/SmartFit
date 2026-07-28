"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { orderService } from "../../../services/order.service";
import Spinner from "../../../components/ui/Spinner";
import { Check, X } from "lucide-react";

// VNPay response codes — '00' = success, everything else = failure
// Full code list: https://sandbox.vnpayment.vn/apis/docs/bang-ma-loi/
const SUCCESS_CODE = "00";

interface Props {
  responseCode: string;
  vnpTxnRef: string;
  orderId: number;
}

export default function PaymentResultPage({
  responseCode,
  vnpTxnRef,
  orderId,
}: Props) {
  const router = useRouter();

  const isSuccess = responseCode === SUCCESS_CODE;

  // Poll the real order status from DB — IPN is authoritative, not this return URL.
  // Give IPN a short delay to process before checking.
  const [delayElapsed, setDelayElapsed] = useState(false);
  useEffect(() => {
    if (!isSuccess || !orderId) return;
    const timer = setTimeout(() => setDelayElapsed(true), 2000);
    return () => clearTimeout(timer);
  }, [isSuccess, orderId]);

  const orderStatusQuery = useQuery({
    queryKey: ["payment-result-order", orderId],
    queryFn: () => orderService.getOrder(Number(orderId)),
    enabled: isSuccess && !!orderId && delayElapsed,
    retry: false,
  });
  const orderStatus = orderStatusQuery.data?.status ?? null;
  const polling =
    isSuccess && !!orderId && (!delayElapsed || orderStatusQuery.isFetching);

  if (polling) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 flex items-center justify-center">
        <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-6 rounded-3xl bg-white p-12 shadow-sm border border-slate-200 text-center">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-slate-500">
            Confirming your payment…
          </p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 flex items-center justify-center">
        <div className="mx-auto max-w-md w-full px-6 py-12 text-center rounded-3xl bg-white shadow-sm border border-slate-200">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <Check className="h-7 w-7 text-emerald-500" strokeWidth={3} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Payment Successful!
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Your order has been placed.
            {orderStatus && (
              <span className="block mt-1 text-sm font-medium text-slate-500">
                Status: {orderStatus}
              </span>
            )}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {orderId && (
              <button
                onClick={() => router.push(`/orders/${orderId}`)}
                className="inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30"
              >
                View Order
              </button>
            )}
            <button
              onClick={() => router.push("/")}
              className="inline-block rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Failure
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
    <div className="min-h-screen bg-slate-50 py-10 flex items-center justify-center">
      <div className="mx-auto max-w-md w-full px-6 py-12 text-center rounded-3xl bg-white shadow-sm border border-slate-200">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <X className="h-7 w-7 text-red-500" strokeWidth={3} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Payment Failed
        </h1>
        <p className="mt-2 text-base text-slate-600">{errorMsg}</p>
        {responseCode && (
          <p className="mt-2 text-xs font-medium text-slate-400">
            Error Code: {responseCode}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => router.push("/checkout")}
            className="inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30"
          >
            Try Again
          </button>
          <button
            onClick={() => router.push("/orders")}
            className="inline-block rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900"
          >
            My Orders
          </button>
        </div>
      </div>
    </div>
  );
}
