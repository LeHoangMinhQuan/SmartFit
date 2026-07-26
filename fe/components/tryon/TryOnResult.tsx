"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { tryonService } from "../../services/tryon.service";
import Spinner from "../ui/Spinner";
import type { TryOnFailureReason } from "../../interfaces";

interface TryOnResultProps {
  sessionId: number;
  onReset: () => void;
}

const POLL_MS = 3000;

// User-facing copy per backend failure reason (tryon.config.ts
// TryonFailureReason). Falls back to a generic message for any reason not
// listed here so a backend addition can't blank the UI.
const FAILURE_MESSAGES: Record<TryOnFailureReason, string> = {
  endpoint_not_registered:
    "The try-on service isn't connected right now. Please try again shortly.",
  endpoint_offline:
    "The try-on service is temporarily offline. Please try again shortly.",
  inference_error:
    "Something went wrong generating your preview. Please try again.",
  timeout: "Generation took too long and timed out. Please try again.",
};

export default function TryOnResult({ sessionId, onReset }: TryOnResultProps) {
  const [rateLimited, setRateLimited] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: poll = { status: "processing" }, error } = useQuery({
    queryKey: ["tryon-preview", sessionId],
    queryFn: () => tryonService.getPreviewStatus(sessionId),
    // Don't let React Query's default retry logic mask a 429 behind extra
    // attempts — we want the rate-limit effect below to see it right away.
    retry: false,
    // Stop polling once we've reached a terminal status, or while we're
    // sitting out a rate-limit cooldown.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "ready" || status === "failed") return false;
      if (rateLimited) return false;
      return POLL_MS;
    },
  });

  useEffect(() => {
    // NOTE: a 429 while polling comes from the global 200/15min limiter,
    // NOT the 5/10min limiter on session creation — the two are different
    // limits on different endpoints. Other errors: keep polling silently.
    const status = (error as { response?: { status?: number } } | null)
      ?.response?.status;
    if (status === 429 && !rateLimited) {
      setRateLimited(true);
      setCountdown(60); // show 60s countdown before allowing retry
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
    }
    return () => {
      clearInterval(countdownRef.current!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  if (rateLimited) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-orange-600 font-medium">
          Too many requests — please slow down a moment.
        </p>
        <p className="text-xs text-gray-500">
          Please wait {countdown}s before trying again.
        </p>
        <button
          onClick={onReset}
          className="mt-2 rounded-lg border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (poll.status === "processing") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Spinner size="lg" />
        <p className="text-sm text-gray-500">Generating your try-on preview…</p>
      </div>
    );
  }

  if (poll.status === "failed") {
    const message =
      FAILURE_MESSAGES[poll.reason] ??
      "Preview generation failed. Please try again.";
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="text-sm text-red-600">{message}</p>
        <button
          onClick={onReset}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50"
        >
          Try Again
        </button>
      </div>
    );
  }

  // poll.status === "ready"
  return (
    <div className="flex flex-col items-center gap-4">
      <img
        src={poll.result_url}
        alt="Try-on result"
        className="max-h-[500px] rounded-xl object-contain shadow-md"
      />
      <div className="flex gap-3">
        <a
          href={poll.result_url}
          download="tryon-result.jpg"
          className="rounded-lg bg-black px-5 py-2 text-sm text-white hover:bg-gray-800"
        >
          Download
        </a>
        <button
          onClick={onReset}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50"
        >
          Try Another
        </button>
      </div>
    </div>
  );
}
