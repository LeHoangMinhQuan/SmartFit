import { Suspense } from "react";
import PageContent from "./PageContent";
import Spinner from "../../../components/ui/Spinner";

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{
    responseCode: string;
    vnpTxnRef: number;
    orderId: number;
  }>;
}) {
  const params = await searchParams;

  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      }
    >
      <PageContent
        responseCode={params.responseCode}
        vnpTxnRef={Number(params.vnpTxnRef)}
        orderId={Number(params.orderId)}
      />
    </Suspense>
  );
}
