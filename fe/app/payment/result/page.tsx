import { Suspense } from "react";
import type { Metadata } from "next";
import PageContent from "./PageContent";
import Spinner from "../../../components/ui/Spinner";

// VNPay redirect target with transaction params in the URL — never
// something a search result should show (personal + a dead link once
// the transaction has been processed). See app/robots.ts's matching
// disallow on /payment.
export const metadata: Metadata = {
  title: "Payment Result",
  robots: { index: false, follow: false },
};

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{
    vnp_ResponseCode?: string;
    vnp_TxnRef?: string;
  }>;
}) {
  const params = await searchParams;

  const responseCode = params.vnp_ResponseCode ?? "";
  const vnpTxnRef = params.vnp_TxnRef ?? "";
  // vnp_TxnRef is "{orderId}-{timestamp}" — orderId is the part before the first "-"
  const orderId = Number(vnpTxnRef.split("-")[0]);

  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      }
    >
      <PageContent
        responseCode={responseCode}
        vnpTxnRef={vnpTxnRef}
        orderId={orderId}
      />
    </Suspense>
  );
}
