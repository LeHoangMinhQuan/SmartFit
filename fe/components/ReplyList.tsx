"use client";

import { useState } from "react";
import { CornerDownRight, Loader2, Trash2 } from "lucide-react";
import type { ReviewReply } from "../interfaces";
import { formatDateTime } from "../lib/utils";
import Badge from "./ui/Badge";

/**
 * components/ReplyList.tsx
 *
 * Shared reply-thread UI for a single review — used on both the
 * customer-facing product page (components/product/ReviewSection.tsx,
 * via services/review.service.ts) and the staff review dashboard
 * (app/staff/reviews/page.tsx, via services/staff/review.service.ts).
 * Those two contexts hit the same backend route
 * (POST/DELETE /reviews/:review_id/replies, .../replies/:reply_id) but
 * through different axios clients (cookie vs Bearer — see
 * authenticateEither.ts), so this component takes plain callback props
 * instead of importing either service directly, letting each caller wire
 * up its own client/mutation.
 *
 * Ownership rule (matches the backend exactly — see review.routes.ts's
 * comment on the replies section): a reply is deletable only by whoever
 * wrote THAT reply. `currentActor` identifies "me" so the delete button
 * only ever appears on my own replies — not on the review author's
 * replies, and not for staff/admin viewing someone else's reply, since
 * there is deliberately no moderation override for replies yet.
 */

export interface ReplyActor {
  type: "customer" | "staff";
  id: number;
}

interface ReplyListProps {
  replies: ReviewReply[];
  currentActor: ReplyActor | null;
  onPostReply?: (comment: string) => Promise<unknown>;
  onDeleteReply?: (reply_id: number) => Promise<unknown>;
  /** Label shown on the reply author line when it's a staff/admin reply. */
  staffLabel?: string;
}

function isMine(reply: ReviewReply, actor: ReplyActor | null): boolean {
  if (!actor) return false;
  if (actor.type === "customer") return reply.user_id === actor.id;
  return reply.staff_id === actor.id;
}

function authorName(reply: ReviewReply, staffLabel: string): string {
  if (reply.staff_id != null) return reply.staff_name ?? staffLabel;
  if (reply.user_id != null) return reply.username ?? "Customer";
  // Both null: author's account was deleted (ON DELETE SET NULL —
  // see the review_reply schema comment), comment text survives.
  return "Deleted user";
}

export default function ReplyList({
  replies,
  currentActor,
  onPostReply,
  onDeleteReply,
  staffLabel = "Staff",
}: ReplyListProps) {
  const [open, setOpen] = useState(replies.length > 0);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!onPostReply || !comment.trim()) return;
    setPosting(true);
    try {
      await onPostReply(comment.trim());
      setComment("");
      setOpen(true);
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(reply_id: number) {
    if (!onDeleteReply) return;
    setDeletingId(reply_id);
    try {
      await onDeleteReply(reply_id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-3 pl-4 border-l-2 border-slate-100">
      {replies.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          <CornerDownRight className="h-3.5 w-3.5" />
          {open
            ? "Hide"
            : `Show ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
        </button>
      )}

      {open && (
        <ul className="flex flex-col gap-3">
          {replies.map((reply) => (
            <li
              key={reply.reply_id}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">
                  {authorName(reply, staffLabel)}
                  {reply.staff_id != null && (
                    <Badge variant="info" className="ml-1.5">
                      {staffLabel}
                    </Badge>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {formatDateTime(reply.created_at)}
                  </span>
                  {isMine(reply, currentActor) && onDeleteReply && (
                    <button
                      type="button"
                      onClick={() => handleDelete(reply.reply_id)}
                      disabled={deletingId === reply.reply_id}
                      aria-label="Delete reply"
                      className="text-slate-400 transition hover:text-red-500 disabled:opacity-40"
                    >
                      {deletingId === reply.reply_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-slate-600">{reply.comment}</p>
            </li>
          ))}
        </ul>
      )}

      {onPostReply && currentActor && (
        <form onSubmit={handlePost} className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a reply..."
            maxLength={255}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
          <button
            type="submit"
            disabled={posting || !comment.trim()}
            className="shrink-0 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:pointer-events-none disabled:opacity-40"
          >
            {posting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Reply"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
