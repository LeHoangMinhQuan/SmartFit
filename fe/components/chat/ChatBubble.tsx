"use client";

import { MessageCircle, X } from "lucide-react";
import { useChatUiStore } from "@/store/useChatUiStore";

/**
 * Fixed-position toggle button, mounted once in app/(customer)/layout.tsx.
 * Visible to guests too — see ChatPanel.tsx for the login-gating on send.
 */
export default function ChatBubble() {
  const isOpen = useChatUiStore((state) => state.isOpen);
  const toggleOpen = useChatUiStore((state) => state.toggleOpen);

  return (
    <button
      onClick={toggleOpen}
      aria-label={isOpen ? "Close chat" : "Open shopping assistant"}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
    >
      {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
    </button>
  );
}
