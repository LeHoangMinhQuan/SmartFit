"use client";

import { useEffect, useRef, useState } from "react";
import { tryonService } from "../../services/tryon.service";
import Spinner from "../ui/Spinner";
import type { TryOnSession } from "../../interfaces";

interface TryOnResultProps {
  sessionId: number;
  onReset: () => void;
}

const POLL_MS = 3000;

export default function TryOnResult({ sessionId, onReset }: TryOnResultProps) {
  const [status, setStatus] = useState<TryOnSession["status"]>("processing");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function poll() {
      tryonService
        .getPreviewStatus(sessionId)
        .then((session) => {
          setStatus(session.status);
          if (session.status === "ready") {
            setResultUrl(session.result_url ?? null);
            clearInterval(timerRef.current!);
          } else if (session.status === "failed") {
            clearInterval(timerRef.current!);
          }
        })
        .catch((err) => {
          if (err?.response?.status === 429) {
            // Rate limited — 5 requests per 10 minutes
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

    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => {
      clearInterval(timerRef.current!);
      clearInterval(countdownRef.current!);
    };
  }, [sessionId]);

  if (rateLimited) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-orange-600 font-medium">
          Rate limit reached (5 try-ons per 10 minutes).
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

  if (status === "processing") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <Spinner size="lg" />
        <p className="text-sm text-gray-500">Generating your try-on preview…</p>
      </div>
    );
  }

  if (status === "failed" || !resultUrl) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="text-sm text-red-600">
          Preview generation failed. Please try again.
        </p>
        <button
          onClick={onReset}
          className="rounded-lg border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <img
        src={resultUrl}
        alt="Try-on result"
        className="max-h-[500px] rounded-xl object-contain shadow-md"
      />
      <div className="flex gap-3">
        <a
          href={resultUrl}
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
