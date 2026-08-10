import type { Metadata } from "next";
import { cache } from "react";
import { productService } from "@/services/product.service";
import { SITE_URL, SITE_NAME } from "@/lib/seo";
import type { Product } from "@/interfaces";

// page.tsx in this folder is "use client" (fetches the product
// client-side via react-query for interactivity — variant selection,
// add-to-cart, wishlist toggling). A client component can't export
// `generateMetadata`, so this sibling layout does the one server-side
// fetch needed for per-product <title>/description/OG tags and JSON-LD —
// without it, every product page shared the exact same generic title,
// which is a real loss for an e-commerce catalog (product titles/
// descriptions are most of what long-tail search traffic actually is).
interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

// Deduped per-request (React cache()) — generateMetadata and the layout
// component below both need the same product, and without this they'd
// each fire their own GET /products/:id against the backend.
const safeGetProduct = cache(async (id: number): Promise<Product | null> => {
  try {
    return await productService.getProduct(id);
  } catch {
    return null;
  }
});

function calcDiscounted(
  base: number,
  d: NonNullable<Product["variants"][number]["discount"]>,
): number {
  if (d.voucher_type === "percent") {
    return Math.max(0, base - (base * d.voucher_value) / 100);
  }
  return Math.max(0, base - d.voucher_value);
}

function lowestVariantPrice(product: Product): number | null {
  const prices = product.variants.map((v) =>
    v.discount ? calcDiscounted(v.base_price, v.discount) : v.base_price,
  );
  return prices.length ? Math.min(...prices) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await safeGetProduct(Number(id));

  if (!product) {
    return { title: "Product not found", robots: { index: false } };
  }

  const image =
    product.images[0]?.s3_url ?? product.variants[0]?.images[0]?.s3_url;
  const price = lowestVariantPrice(product);

  return {
    title: product.name,
    description:
      product.description ||
      `Shop ${product.name} at ${SITE_NAME} — quality fashion with virtual try-on.`,
    alternates: { canonical: `/product/${product.product_id}` },
    openGraph: {
      title: product.name,
      description: product.description,
      images: image ? [{ url: image }] : undefined,
      type: "website",
    },
    other:
      price != null ? { "product:price:amount": String(price) } : undefined,
  };
}

export default async function ProductLayout({ params, children }: Props) {
  const { id } = await params;
  const product = await safeGetProduct(Number(id));

  // JSON-LD structured data — this is what lets Google show rich results
  // (price, stock, star rating) directly in search listings instead of a
  // plain blue link. Rendered here (server component) rather than from
  // the client page, since it needs to exist in the initial HTML for
  // crawlers that don't fully execute client JS before parsing markup.
  const jsonLd = product
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: product.images.map((img) => img.s3_url),
        brand: { "@type": "Brand", name: SITE_NAME },
        url: `${SITE_URL}/product/${product.product_id}`,
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "VND",
          lowPrice: lowestVariantPrice(product) ?? undefined,
          offerCount: product.variants.length,
          availability: product.variants.some((v) => (v.stock ?? 0) > 0)
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
