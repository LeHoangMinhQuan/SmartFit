"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { productService } from "@/services/product.service";
import { useDebounce } from "@/hooks/useDebounce";
import { formatPrice } from "@/lib/utils";
import { Search } from "lucide-react";

interface SearchBarProps {
  autoFocus?: boolean;
  // Called after a successful submit or result click — lets Header close
  // the mobile search panel without SearchBar knowing anything about it.
  onNavigate?: () => void;
  className?: string;
}

const PREVIEW_LIMIT = 5;
// Below this length the query is almost never specific enough to be
// useful and every extra keystroke would otherwise re-fire a request —
// 2 chars is the shortest a real product name/word tends to start
// meaningfully differing at (matches ProductFilters' min-length convention
// elsewhere in this app, kept the same here for consistency).
const MIN_QUERY_LENGTH = 2;

/**
 * Search input + submit, with a debounced dropdown preview of matching
 * products shown while typing — before the user submits or presses Enter.
 * Reuses the same GET /products/search endpoint as the full results page
 * (services/product.service.ts's searchProducts) with a small `limit`,
 * rather than a separate suggestions endpoint — it's a cheap ILIKE query
 * (see product.model.ts), not the embedding-based hybrid retrieval the AI
 * assistant uses, so it's safe to call on (debounced) every keystroke.
 */
export default function SearchBar({
  autoFocus,
  onNavigate,
  className,
}: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedValue = useDebounce(value, 300);
  const trimmed = debouncedValue.trim();
  const queryEnabled = open && trimmed.length >= MIN_QUERY_LENGTH;

  const previewQuery = useQuery({
    queryKey: ["search-preview", trimmed],
    queryFn: () =>
      productService.searchProducts(trimmed, { limit: PREVIEW_LIMIT }),
    enabled: queryEnabled,
    staleTime: 30_000,
  });

  // Close on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function submitSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = value.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
    onNavigate?.();
  }

  function handleResultClick() {
    setOpen(false);
    onNavigate?.();
  }

  const showDropdown =
    open && trimmed.length >= MIN_QUERY_LENGTH && value.trim().length > 0;
  const results = previewQuery.data?.data ?? [];
  const total = previewQuery.data?.meta.total ?? 0;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <form
        onSubmit={submitSearch}
        className="flex items-center bg-[#F0F0F0] rounded-full px-4 py-2 w-full"
      >
        <button
          type="submit"
          aria-label="Search"
          className="text-gray-400 mr-2 shrink-0"
        >
          🔍
        </button>
        <input
          type="text"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              e.currentTarget.blur();
            }
          }}
          placeholder="Search for products..."
          className="bg-transparent outline-none w-full text-black placeholder-gray-400"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-preview-list"
          autoComplete="off"
        />
      </form>

      {showDropdown && (
        <div
          id="search-preview-list"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg"
        >
          {previewQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Search className="h-5 w-5 text-gray-300" />
              <p className="text-sm text-gray-500">
                No products matched &ldquo;{trimmed}&rdquo;.
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {results.map((p) => (
                  <li key={p.product_id}>
                    <Link
                      href={`/product/${p.product_id}`}
                      onClick={handleResultClick}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#F0EEED]">
                        {p.image && (
                          <Image
                            src={p.image}
                            alt={p.name}
                            fill
                            sizes="48px"
                            className="object-cover object-center"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-black">
                          {p.name}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span
                            className={
                              p.discountActive
                                ? "text-sm font-semibold text-red-600"
                                : "text-sm font-semibold text-black"
                            }
                          >
                            {p.price != null ? formatPrice(p.price) : "—"}
                          </span>
                          {p.discountActive && p.originalPrice != null && (
                            <>
                              <span className="text-xs text-gray-400 line-through">
                                {formatPrice(p.originalPrice)}
                              </span>
                              {p.price != null && (
                                <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] font-semibold text-red-600">
                                  -
                                  {Math.round(
                                    (1 - p.price / p.originalPrice) * 100,
                                  )}
                                  %
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => submitSearch()}
                className="block w-full border-t border-gray-100 px-4 py-3 text-center text-sm font-medium text-black transition hover:bg-gray-50 hover:cursor-pointer"
              >
                See all {total} result{total === 1 ? "" : "s"} for &ldquo;
                {trimmed}&rdquo;
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
