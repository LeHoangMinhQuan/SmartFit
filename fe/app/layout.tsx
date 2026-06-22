import type { Metadata } from "next";
import "./globals.css";
// Assume you create these components based on the design
import TopBanner from "@/components/TopBanner";
import Newsletter from "@/components/Newsletter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "SHOP.CO | Find Clothes That Matches Your Style",
  description: "E-commerce store for fashion and virtual try-on.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white text-black font-sans antialiased">
        <TopBanner />
        <Header />
        <main className="min-h-screen bg-white">{children}</main>
        <Newsletter />
        <Footer />
      </body>
    </html>
  );
}
