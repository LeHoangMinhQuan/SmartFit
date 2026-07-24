"use client";

import { useEffect, useRef, useState } from "react";
import { tryonService } from "../../services/tryon.service";
import Spinner from "../ui/Spinner";
import type { TryOnPollResult, TryOnFailureReason } from "../../interfaces";

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
  const [poll, setPoll] = useState<TryOnPollResult>({ status: "processing" });
  const [rateLimited, setRateLimited] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function doPoll() {
      tryonService
        .getPreviewStatus(sessionId)
        .then((result) => {
          setPoll(result);
          if (result.status === "ready" || result.status === "failed") {
            clearInterval(timerRef.current!);
          }
        })
        .catch((err) => {
          if (err?.response?.status === 429) {
            // NOTE: a 429 while polling comes from the global 200/15min
            // limiter, NOT the 5/10min limiter on session creation — the
            // two are different limits on different endpoints.
            clearInterval(timerRef.current!);
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
          // Other errors: keep polling silently
        });
    }

    doPoll();
    timerRef.current = setInterval(doPoll, POLL_MS);
    return () => {
      clearInterval(timerRef.current!);
      clearInterval(countdownRef.current!);
    };
  }, [sessionId]);

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
