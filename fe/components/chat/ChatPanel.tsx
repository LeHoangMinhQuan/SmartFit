"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useAuthStore } from "@/store/useAuthStore";
import { useAuthModalStore } from "@/store/useAuthModalStore";
import { useChatUiStore } from "@/store/useChatUiStore";
import ChatMessageBubble from "./ChatMessageBubble";
import type { ChatMessageMetadata } from "@/interfaces";

type ChatUIMessage = UIMessage<ChatMessageMetadata>;

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

/**
 * components/chat/ChatPanel.tsx
 *
 * Deliberately NOT conditionally unmounted when the bubble is closed
 * (`isOpen` only toggles a CSS class here, never an early `return null`
 * above this component). useChat's live Chat instance is created once via
 * `useRef` internally and does NOT re-read a changing `messages` prop
 * after that first render — so if this component unmounted on every
 * close, reopening would lose whatever streamed in during the closed
 * conversation, with no clean way to resync short of re-fetching from the
 * DB. Since `useChatUiStore.sessionId` is never persisted across page
 * loads (see that store's comments), by the time it's set, this
 * component's own `useChat` instance already has that conversation live
 * in memory — so DB-rehydration-on-reopen (getSessionHistory) isn't
 * actually reachable in this design and isn't wired in here. That
 * function still exists in chat.service.ts for other uses (e.g. a future
 * "past conversations" view).
 */
export default function ChatPanel() {
  const isOpen = useChatUiStore((s) => s.isOpen);
  const setSessionId = useChatUiStore((s) => s.setSessionId);
  const user = useAuthStore((s) => s.user);
  const openLogin = useAuthModalStore((s) => s.openLogin);

  const [input, setInput] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Distinct from rateLimited (429, per-user, self-clears in ~60s): this
  // is the 503 model-router.service.ts throws when BOTH the heavy and
  // lite Gemini daily budgets are exhausted app-wide — a "come back
  // tomorrow" state, not a "slow down" state, so it gets its own message
  // and no countdown. See config/env.ts's GEMINI_*_DAILY_BUDGET comments
  // on the backend for what actually resets it (midnight Pacific).
  const [quotaExhausted, setQuotaExhausted] = useState(false);

  const { messages, sendMessage, status, error, setMessages } =
    useChat<ChatUIMessage>({
      transport: new DefaultChatTransport<ChatUIMessage>({
        api: `${API_BASE_URL}/chat/message`,
        // Auth is httpOnly-cookie based (see lib/axios.ts) — this transport
        // bypasses the axios instance entirely (useChat manages its own
        // fetch), so credentials have to be opted into here separately or
        // the session cookie never gets sent.
        credentials: "include",
        // The backend's POST /chat/message expects { session_id?, message },
        // not the AI SDK's default full-messages-array body — translate here
        // rather than changing the backend's plain-REST contract to match
        // the SDK's own protocol.
        prepareSendMessagesRequest: ({ messages: allMessages }) => {
          const last = allMessages[allMessages.length - 1];
          const text =
            last?.parts
              .filter(
                (p): p is { type: "text"; text: string } => p.type === "text",
              )
              .map((p) => p.text)
              .join("") ?? "";
          // Read live rather than closing over it, since this transport is
          // constructed once but sessionId changes after the first reply.
          const currentSessionId = useChatUiStore.getState().sessionId;
          console.log("[ChatPanel] sending request", {
            text,
            currentSessionId,
          });
          return {
            body: {
              message: text,
              ...(currentSessionId ? { session_id: currentSessionId } : {}),
            },
          };
        },
      }),
      onFinish: ({ message }) => {
        console.log("[ChatPanel] onFinish fired", {
          message_id: message.id,
          role: message.role,
          parts_count: message.parts.length,
          metadata: message.metadata,
        });
        const newSessionId = message.metadata?.session_id;
        if (newSessionId) setSessionId(newSessionId);
      },
      onError: (err) => {
        // DEBUG: useChat's onError only fires for transport-level failures
        // (non-ok HTTP response, network error, stream-parse error) — it
        // does NOT fire just because the stream is slow/stalled. If nothing
        // logs here AND onFinish above never fires either, the stream is
        // genuinely hanging server-side (check backend logs), not erroring.
        console.error("[ChatPanel] onError fired", err);
      },
    });

  // DEBUG: status is the single source of truth for "is the UI stuck
  // loading" — trace every transition so you can see exactly which state
  // it's stuck in (submitted = waiting for first byte, streaming = bytes
  // arriving but not yet finished, ready = done, error = onError above
  // already logged the why).
  useEffect(() => {
    console.log("[ChatPanel] status changed:", status);
  }, [status]);

  // ai's fetch transport throws a plain Error whose .message is the raw
  // response body text on a non-ok response — there's no structured status
  // code on the error object itself. Our backend's rate limiter responds
  // with JSON ({ statusCode: 429, ... }), so recover the status by parsing
  // that body text by hand.
  useEffect(() => {
    if (!error) return;
    let parsed: { statusCode?: number; message?: string } | undefined;
    try {
      parsed = JSON.parse(error.message);
    } catch {
      // Not JSON — a network error or similar; no special handling.
      return;
    }
    if (parsed?.statusCode === 429 && !rateLimited) {
      setQuotaExhausted(false);
      setRateLimited(true);
      setCountdown(60);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current!);
            setRateLimited(false);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } else if (parsed?.statusCode === 503) {
      // model-router.service.ts's ApiError(503) — both Gemini daily
      // budgets exhausted, or (less likely) both RPM windows saturated
      // at once. No countdown: unlike a 429's rolling window, the daily
      // case doesn't clear for hours, and there's no reliable client-side
      // way to tell which sub-case it is from the message alone.
      setRateLimited(false);
      setQuotaExhausted(true);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // Clear the quota-exhausted banner as soon as a new send attempt is
  // made — if the budget genuinely hasn't reset, the same 503 will just
  // fire again and re-set it; this only avoids the banner going stale
  // after Google's midnight-Pacific reset.
  const clearQuotaExhausted = () => setQuotaExhausted(false);

  const isBusy = status === "streaming" || status === "submitted";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isBusy) return;
    if (!user) {
      openLogin();
      return;
    }
    clearQuotaExhausted();
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div
      className={`fixed bottom-24 right-6 z-50 flex h-[32rem] w-96 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl ${
        isOpen ? "flex" : "hidden"
      }`}
    >
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          SmartFit Assistant
        </h2>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400">
            Ask me to find something, or add an item to your cart.
          </p>
        ) : (
          messages.map((m) => <ChatMessageBubble key={m.id} message={m} />)
        )}
        {status === "submitted" && (
          <p className="text-xs italic text-gray-400">Thinking…</p>
        )}
      </div>

      {quotaExhausted ? (
        <div className="border-t border-gray-100 px-4 py-3 text-center">
          <p className="text-xs font-medium text-red-600">
            The shopping assistant has reached its usage limit for now.
          </p>
          <p className="text-xs text-gray-500">
            Please try again later, or browse the catalog directly in the
            meantime.
          </p>
        </div>
      ) : rateLimited ? (
        <div className="border-t border-gray-100 px-4 py-3 text-center">
          <p className="text-xs font-medium text-orange-600">
            Too many messages — please slow down a moment.
          </p>
          <p className="text-xs text-gray-500">
            Please wait {countdown}s before trying again.
          </p>
        </div>
      ) : !user ? (
        <div className="border-t border-gray-100 px-4 py-3 text-center">
          <p className="mb-2 text-xs text-gray-500">
            Log in to chat with the shopping assistant.
          </p>
          <button
            onClick={openLogin}
            className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 hover:cursor-pointer"
          >
            Log in
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-gray-100 px-3 py-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a product…"
            disabled={isBusy}
            className="flex-1 rounded-full border border-gray-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-black/20"
          />
          <button
            type="submit"
            disabled={isBusy || !input.trim()}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}