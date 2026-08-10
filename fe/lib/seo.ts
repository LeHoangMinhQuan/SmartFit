/**
 * lib/seo.ts
 *
 * Single source of truth for the site's canonical origin — reused by
 * app/layout.tsx's metadataBase, app/sitemap.ts, app/robots.ts, and any
 * page building an absolute URL (canonical links, JSON-LD, OG images).
 * Keeping this in one place means a future domain change is a one-line
 * edit instead of a grep across every page.
 */
export const SITE_URL = "https://shop.lhmquan.qzz.io";
export const SITE_NAME = "SMARTFIT";

/** Join a path onto SITE_URL without worrying about double/missing slashes. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
