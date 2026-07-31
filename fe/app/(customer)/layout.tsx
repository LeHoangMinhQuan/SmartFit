// fe/app/(customer)/layout.tsx
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import TopBanner from "../../components/layout/TopBanner";
import { Toaster } from "../../components/ui/Toast";
import ChatBubble from "../../components/chat/ChatBubble";
import ChatPanel from "../../components/chat/ChatPanel";

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
      {/* AI shopping assistant — reachable from every customer page, not a
          dedicated route. See ChatPanel.tsx for why it's never conditionally
          unmounted based on open/closed state. */}
      <ChatBubble />
      <ChatPanel />
    </>
  );
}
