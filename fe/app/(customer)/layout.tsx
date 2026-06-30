import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import TopBanner from "../../components/layout/TopBanner";
import { Toaster } from "../../components/ui/Toast";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopBanner />
      <Header />
      <main>{children}</main>
      <Footer />
      {/* Mounted once here — toast.success/error/info from anywhere render into this */}
      <Toaster />
    </>
  );
}
