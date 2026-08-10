import "./globals.css";
import type { Metadata } from "next";
import Providers from "./providers";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: "SMARTFIT - Your Ultimate Fashion Destination",
    template: "%s | SMARTFIT",
  },

  description:
    "Discover fashionable clothing and accessories at SMARTFIT. Shop the latest styles with virtual try-on for every occasion.",

  keywords: [
    "SMARTFIT",
    "online fashion store",
    "clothing shop",
    "virtual try-on",
    "buy clothes online",
    "fashion accessories",
  ],

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,
  },

  // Displayed by Facebook/Zalo/Messenger/LinkedIn link previews and by
  // some social-referral snippets Google itself surfaces — without this,
  // a shared product/category link previously showed no image/title at
  // all (falls back to a bare URL in most chat apps).
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "SMARTFIT - Your Ultimate Fashion Destination",
    description:
      "Discover fashionable clothing and accessories at SMARTFIT. Shop the latest styles with virtual try-on for every occasion.",
    url: SITE_URL,
  },

  twitter: {
    card: "summary_large_image",
    title: "SMARTFIT - Your Ultimate Fashion Destination",
    description:
      "Discover fashionable clothing and accessories at SMARTFIT. Shop the latest styles with virtual try-on for every occasion.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
