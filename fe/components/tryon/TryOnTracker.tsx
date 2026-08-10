"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { tryonService } from "../../services/tryon.service";
import { toast } from "../ui/Toast";
import Spinner from "../ui/Spinner";
import { useTryOnTrackerStore } from "../../store/useTryOnTrackerStore";
import type { TrackedTryOnSession } from "../../store/useTryOnTrackerStore";
import type { TryOnFailureReason } from "../../interfaces";

const POLL_MS = 3000;

const FAILURE_MESSAGES: Record<TryOnFailureReason, string> = {
  endpoint_not_registered: "The try-on service isn't connected right now.",
  endpoint_offline: "The try-on service is temporarily offline.",
  inference_error: "Something went wrong generating your preview.",
  timeout: "Generation took too long and timed out.",
};

/**
 * Mounted once in app/(customer)/layout.tsx (same pattern as <Toaster />
 * and <ChatBubble />) so it survives navigation — unlike the old design
 * where progress only showed on the /tryon page itself (see
 * TryOnResult.tsx), and left with the user the moment they navigated
 * away to browse another product.
 *
 * Each card here polls GET /tryon/preview/:id under the exact same
 * react-query key ["tryon-preview", session_id] that TryOnResult.tsx
 * uses — if the user is also looking at the /tryon page for the same
 * session, react-query dedupes the two into a single shared request/
 * interval rather than double-polling.
 */
export default function TryOnTracker() {
  const hasHydrated = useTryOnTrackerStore((s) => s.hasHydrated);
  const sessions = useTryOnTrackerStore((s) => s.sessions);
  const pruneStale = useTryOnTrackerStore((s) => s.pruneStale);

  useEffect(() => {
    if (hasHydrated) pruneStale();
    // Only needs to run once, right after hydration settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  if (!hasHydrated || sessions.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 sm:right-6">
      {sessions.map((s) => (
        <TrackedCard key={s.session_id} session={s} />
      ))}
    </div>
  );
}

function TrackedCard({ session }: { session: TrackedTryOnSession }) {
  const router = useRouter();
  const untrack = useTryOnTrackerStore((s) => s.untrack);
  const markNotified = useTryOnTrackerStore((s) => s.markNotified);

  const { data: poll = { status: "processing" } } = useQuery({
    queryKey: ["tryon-preview", session.session_id],
    queryFn: () => tryonService.getPreviewStatus(session.session_id),
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "ready" || status === "failed" ? false : POLL_MS;
    },
  });

  // One-shot toast the moment a session first resolves — the card itself
  // stays put as the persistent, clickable record, this is just the
  // "ding" so the user notices even if they're not looking at this
  // corner of the screen right now.
  useEffect(() => {
    if (poll.status === "processing" || session.notified) return;
    if (poll.status === "ready") {
      toast.success(
        `Your try-on preview${session.product_name ? ` for ${session.product_name}` : ""} is ready!`,
      );
    } else if (poll.status === "failed") {
      toast.error(
        `Your try-on preview${session.product_name ? ` for ${session.product_name}` : ""} failed.`,
      );
    }
    markNotified(session.session_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll.status]);

  function goToResult() {
    router.push(
      `/tryon?product_id=${session.product_id}&variant_id=${session.variant_id}&session_id=${session.session_id}`,
    );
  }

  return (
    <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div
        onClick={poll.status === "ready" ? goToResult : undefined}
        className={clsx(
          "relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100",
          poll.status === "ready" && "cursor-pointer",
        )}
      >
        {session.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              poll.status === "ready" ? poll.result_url : session.thumbnail_url
            }
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
        {poll.status === "processing" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Spinner size="sm" />
          </div>
        )}
      </div>

      <div
        onClick={poll.status === "ready" ? goToResult : undefined}
        className={clsx(
          "min-w-0 flex-1",
          poll.status === "ready" && "cursor-pointer",
        )}
      >
        <p className="truncate text-sm font-medium text-slate-900">
          {session.product_name ?? "Try-on preview"}
        </p>
        {poll.status === "processing" && (
          <p className="text-xs text-slate-500">Generating your preview…</p>
        )}
        {poll.status === "ready" && (
          <p className="text-xs font-medium text-emerald-600">
            Ready — tap to view
          </p>
        )}
        {poll.status === "failed" && (
          <p className="text-xs text-red-500">
            {FAILURE_MESSAGES[poll.reason] ?? "Generation failed."}
          </p>
        )}
      </div>

      <button
        onClick={() => untrack(session.session_id)}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1 text-slate-400 transition hover:cursor-pointer hover:bg-slate-100 hover:text-slate-600"
      >
        ✕
      </button>
    </div>
  );
}
