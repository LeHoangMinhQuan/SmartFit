// fe/app/(customer)/layout.tsx
import Header from "../../components/layout/Header";
import Footer from "../../components/layout/Footer";
import TopBanner from "../../components/layout/TopBanner";
import { Toaster } from "../../components/ui/Toast";
import ChatBubble from "../../components/chat/ChatBubble";
import ChatPanel from "../../components/chat/ChatPanel";
import TryOnTracker from "../../components/tryon/TryOnTracker";

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
      <Toaster />
      <ChatBubble />
      <ChatPanel />
      <TryOnTracker />
    </>
  );
}
