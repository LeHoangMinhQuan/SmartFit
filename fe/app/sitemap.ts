import type { MetadataRoute } from "next";
import { categoryService } from "@/services/category.service";
import { productService } from "@/services/product.service";
import { SITE_URL } from "@/lib/seo";
import type { Category } from "@/interfaces";

// Regenerate at most once an hour — this hits the backend for every
// category and every page of products, so serving it fresh on every
// single crawler request would be wasteful (Googlebot re-fetches
// sitemaps periodically, not continuously; an hour-old catalog snapshot
// is more than fresh enough).
export const revalidate = 3600;

function flattenCategories(nodes: Category[]): Category[] {
  const result: Category[] = [];
  function walk(list: Category[]) {
    for (const n of list) {
      result.push(n);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}

// Next.js serves this at /sitemap.xml automatically (app router metadata
// route convention). Runs at request time (or build time for static
// export), hitting the same backend the site itself uses — see
// productService/categoryService — so it can never drift from what's
// actually live, unlike a hand-maintained sitemap file.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE_URL}/categories`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    { url: `${SITE_URL}/tryon`, changeFrequency: "monthly", priority: 0.6 },
  ];

  // Categories — same URL-building rule as
  // components/landing/FeaturedCategoriesSection.tsx
  // (encodeURIComponent(category.name), NOT a hyphenated slug) so these
  // links actually resolve on category/[slug]/page.tsx's resolveCategory.
  let categoryRoutes: MetadataRoute.Sitemap = [];
  try {
    const categories = await categoryService.getCategories();
    categoryRoutes = flattenCategories(categories).map((c) => ({
      url: `${SITE_URL}/category/${encodeURIComponent(c.name)}`,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    // Backend unreachable at build/request time — ship the sitemap with
    // just the static routes rather than failing the whole route (a
    // partial sitemap beats a 500 on /sitemap.xml).
  }

  // Products — the actual long-tail SEO value for an e-commerce catalog.
  // Paginate through everything rather than capping at one page; GHI/GSC
  // splits sitemaps over ~50k URLs, well above what this catalog needs,
  // so a single file is fine for now.
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const limit = 100;
    let page = 1;
    let totalPages = 1;
    const ids: number[] = [];
    do {
      const result = await productService.getProducts({ page, limit });
      ids.push(...result.data.map((p) => p.product_id));
      totalPages = result.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    productRoutes = ids.map((id) => ({
      url: `${SITE_URL}/product/${id}`,
      changeFrequency: "weekly",
      priority: 0.9,
    }));
  } catch {
    // Same reasoning as categories above.
  }

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
