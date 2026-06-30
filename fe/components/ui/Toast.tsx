"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

type Listener = (msg: ToastMessage) => void;
let listeners: Listener[] = [];
let nextId = 0;

function emit(message: string, type: ToastType) {
  const msg: ToastMessage = { id: nextId++, message, type };
  listeners.forEach((l) => l(msg));
}

// Import and call these anywhere in client code
export const toast = {
  success: (message: string) => emit(message, "success"),
  error: (message: string) => emit(message, "error"),
  info: (message: string) => emit(message, "info"),
};

const typeStyles: Record<ToastType, string> = {
  success: "bg-green-700 text-white",
  error: "bg-red-600 text-white",
  info: "bg-gray-800 text-white",
};

// Mount <Toaster /> once in app/(customer)/layout.tsx
export function Toaster() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler: Listener = (msg) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(
        () => setMessages((prev) => prev.filter((m) => m.id !== msg.id)),
        3500,
      );
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {messages.map((m) => (
        <div
          key={m.id}
          className={clsx(
            "rounded-lg px-4 py-3 text-sm shadow-lg pointer-events-auto",
            typeStyles[m.type],
          )}
        >
          {m.message}
        </div>
      ))}
    </div>
  );
}
