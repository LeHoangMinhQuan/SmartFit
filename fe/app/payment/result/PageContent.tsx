"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { orderService } from "../../../services/order.service";
import Spinner from "../../../components/ui/Spinner";

// VNPay response codes — '00' = success, everything else = failure
// Full code list: https://sandbox.vnpayment.vn/apis/docs/bang-ma-loi/
const SUCCESS_CODE = "00";

interface Props {
  responseCode: string;
  vnpTxnRef: number;
  orderId: number;
}

export default function PaymentResultPage({
  responseCode,
  vnpTxnRef,
  orderId,
}: Props) {
  const router = useRouter();

  const isSuccess = responseCode === SUCCESS_CODE;

  // Poll the real order status from DB — IPN is authoritative, not this return URL
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [polling, setPolling] = useState(isSuccess);

  useEffect(() => {
    if (!isSuccess || !orderId) {
      setPolling(false);
      return;
    }
    // Poll once after a short delay to give IPN time to process
    const timer = setTimeout(async () => {
      try {
        const order = await orderService.getOrder(Number(orderId));
        setOrderStatus(order.status);
      } catch {
        // Non-critical — we already show success based on VNPay response code
      } finally {
        setPolling(false);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isSuccess, orderId]);

  if (polling) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <Spinner size="lg" />
        <p className="text-sm text-gray-500">Confirming your payment…</p>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-24 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          Payment Successful!
        </h1>
        <p className="text-sm text-gray-600">
          Your order has been placed.
          {orderStatus && ` Status: ${orderStatus}.`}
        </p>
        <div className="flex gap-3">
          {orderId && (
            <button
              onClick={() => router.push(`/orders/${orderId}`)}
              className="rounded-lg bg-black px-6 py-2 text-sm text-white hover:bg-gray-800"
            >
              View Order
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="rounded-lg border border-gray-300 px-6 py-2 text-sm hover:bg-gray-50"
          >
            Continue Shopping
          </button>
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
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-24 text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
        ✕
      </div>
      <h1 className="text-2xl font-bold text-gray-900">Payment Failed</h1>
      <p className="text-sm text-gray-600">{errorMsg}</p>
      {responseCode && (
        <p className="text-xs text-gray-400">Code: {responseCode}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => router.push("/checkout")}
          className="rounded-lg bg-black px-6 py-2 text-sm text-white hover:bg-gray-800"
        >
          Try Again
        </button>
        <button
          onClick={() => router.push("/orders")}
          className="rounded-lg border border-gray-300 px-6 py-2 text-sm hover:bg-gray-50"
        >
          My Orders
        </button>
      </div>
    </div>
  );
}
