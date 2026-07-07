import { Suspense } from "react";
import PageContent from "./PageContent";
import Spinner from "../../../components/ui/Spinner";

export default async function TryOnPage({
  searchParams,
}: {
  searchParams: Promise<{
    product_id?: string;
    variant_id?: string;
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
        productId={Number(params.product_id)}
        variantId={Number(params.variant_id)}
      />
    </Suspense>
  );
}
