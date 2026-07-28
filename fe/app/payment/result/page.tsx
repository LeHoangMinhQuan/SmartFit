import { Suspense } from "react";
import PageContent from "./PageContent";
import Spinner from "../../../components/ui/Spinner";

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
