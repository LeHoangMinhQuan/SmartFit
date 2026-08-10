import { Suspense } from "react";
import type { Metadata } from "next";
import PageContent from "./PageContent";
import Spinner from "../../../components/ui/Spinner";

interface Props {
  searchParams: Promise<{
    product_id?: string;
    variant_id?: string;
    session_id?: string;
  }>;
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = await searchParams;
  // The bare /tryon URL is a genuine feature/marketing page — a real
  // differentiator worth ranking for ("AI virtual try-on"). But with a
  // session_id (or a specific product/variant already loaded), it's a
  // personal, transient result tied to one visitor's upload — not
  // something a search result should ever surface.
  const isPersonalSession = Boolean(params.session_id);

  return {
    title: "Virtual Try-On",
    description:
      "Try on clothes virtually before you buy — upload a photo and see how SMARTFIT styles look on you.",
    alternates: { canonical: "/tryon" },
    robots: isPersonalSession
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export default async function TryOnPage({ searchParams }: Props) {
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
        sessionId={params.session_id ? Number(params.session_id) : undefined}
      />
    </Suspense>
  );
}
