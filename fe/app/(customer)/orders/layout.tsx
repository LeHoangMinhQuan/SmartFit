import type { Metadata } from "next";

// page.tsx under this route is "use client" and personal/transactional
// (cart contents, checkout, order history, account details, password
// reset token) — none of it is content a search result should ever
// surface, both for user privacy and because it'd just be indexing
// empty/loading shells anyway. See app/robots.ts for the matching
// disallow rule, which additionally stops it from being crawled at all.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
