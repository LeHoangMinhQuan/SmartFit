"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import type { PaginationMeta } from "../../interfaces";

interface PaginationProps {
  meta: PaginationMeta;
  // Omit to drive ?page= URL navigation (for server-component pages).
  // Provide to control client-side state instead.
  onPageChange?: (page: number) => void;
  className?: string;
}

export default function Pagination({
  meta,
  onPageChange,
  className,
}: PaginationProps) {
  const router = useRouter();
  const params = useSearchParams();
  const { page, totalPages } = meta;

  if (totalPages <= 1) return null;

  function goTo(p: number) {
    if (onPageChange) {
      onPageChange(p);
    } else {
      const next = new URLSearchParams(params.toString());
      next.set("page", String(p));
      router.push(`?${next.toString()}`);
    }
  }

  // Show: first, last, and up to 2 neighbours of current page
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );

  return (
    <nav
      className={clsx("flex justify-center items-center gap-1", className)}
      aria-label="Pagination"
    >
      <button
        onClick={() => goTo(page - 1)}
        disabled={page === 1}
        className="rounded px-3 py-1.5 text-md disabled:opacity-40 hover:bg-gray-100 hover:text-gray-700"
      >
        ←
      </button>

      {pages.map((p, i) => {
        const prev = pages[i - 1];
        return (
          <span key={p} className="flex items-center gap-1">
            {prev && p - prev > 1 && (
              <span className="px-1 text-gray-400">…</span>
            )}
            <button
              onClick={() => goTo(p)}
              className={clsx(
                "rounded px-3 py-1.5 text-md",
                p === page
                  ? "bg-black text-white"
                  : "hover:bg-gray-100 hover:text-gray-700",
              )}
            >
              {p}
            </button>
          </span>
        );
      })}

      <button
        onClick={() => goTo(page + 1)}
        disabled={page === totalPages}
        className="rounded px-3 py-1.5 text-md disabled:opacity-40 hover:bg-gray-100 hover:text-gray-700"
      >
        →
      </button>
    </nav>
  );
}
