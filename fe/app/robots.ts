import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Next.js serves this at /robots.txt automatically (app router metadata
// route convention) — no manual public/robots.txt needed, and it stays
// in sync with SITE_URL instead of a hardcoded domain in a static file.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Internal staff/admin panel — not shopper-facing content, and
          // most of it requires auth anyway (a crawler would just hit
          // login walls or, worse, index an empty/loading shell).
          "/staff",
          // Next.js route handlers (auth callbacks, etc.) — not pages.
          "/api",
          // Personal/transactional pages: same reasoning as their
          // per-route `robots: noindex` metadata (see their layout.tsx
          // files) — disallowing here additionally stops a crawler from
          // ever fetching them, rather than fetching-then-discarding.
          "/cart",
          "/checkout",
          "/orders",
          "/profile",
          "/payment",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
