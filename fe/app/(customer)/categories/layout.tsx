import type { Metadata } from "next";

// page.tsx here is "use client" (fetches categories client-side via
// react-query), so it can't export `metadata`/`generateMetadata` itself —
// a client component's exports are opaque to Next's metadata resolution.
// This sibling layout is the standard workaround: a plain server
// component that only supplies metadata and passes children through.
export const metadata: Metadata = {
  title: "All Categories",
  description:
    "Browse every product category at SMARTFIT — from casual essentials to formal wear, all in one place.",
  alternates: { canonical: "/categories" },
};

export default function CategoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
