"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

interface ComboboxProps<T> {
  label?: string;
  items: T[];
  value: T | null;
  onChange: (item: T | null) => void;
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  getSublabel?: (item: T) => string | undefined;
  // Controlled query text. When provided alongside onQueryChange, the
  // parent owns filtering (e.g. server-side search via productService
  // .searchProducts) rather than this component filtering `items`
  // client-side — pass every item in `items` as already-filtered in
  // that case.
  query?: string;
  onQueryChange?: (query: string) => void;
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

/**
 * A minimal searchable single-select dropdown. Built for the staff
 * vouchers page's "assign discount" form (components/ui doesn't have one
 * yet) — picking a discount/product/variant by typing its name instead of
 * remembering its raw numeric ID.
 */
export default function Combobox<T>({
  label,
  items,
  value,
  onChange,
  getKey,
  getLabel,
  getSublabel,
  query: controlledQuery,
  onQueryChange,
  loading,
  placeholder = "Search…",
  disabled,
  emptyMessage = "No results.",
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const isControlled = controlledQuery !== undefined;
  const query = isControlled ? controlledQuery : internalQuery;

  // Client-side filter only applies when the parent isn't already
  // filtering `items` itself (i.e. no onQueryChange supplied).
  const visibleItems =
    onQueryChange || !query
      ? items
      : items.filter((item) =>
          getLabel(item).toLowerCase().includes(query.toLowerCase()),
        );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function setQuery(q: string) {
    if (isControlled) onQueryChange?.(q);
    else setInternalQuery(q);
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">{label}</label>
      )}
      <input
        type="text"
        disabled={disabled}
        value={open ? query : value ? getLabel(value) : query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onChange(null);
          setOpen(true);
        }}
        placeholder={placeholder}
        className={clsx(
          "w-full rounded-md border px-3 py-2 text-sm outline-none transition placeholder:text-gray-400 text-black",
          "border-gray-300 focus:border-black focus:ring-1 focus:ring-black",
          disabled && "cursor-not-allowed bg-gray-50 opacity-60",
        )}
      />
      {open && !disabled && (
        <div className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-sm text-gray-400">Searching…</p>
          ) : visibleItems.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">{emptyMessage}</p>
          ) : (
            visibleItems.map((item) => (
              <button
                type="button"
                key={getKey(item)}
                onClick={() => {
                  onChange(item);
                  setQuery("");
                  setOpen(false);
                }}
                className={clsx(
                  "block w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                  value && getKey(value) === getKey(item)
                    ? "bg-gray-50 font-medium text-black"
                    : "text-gray-700",
                )}
              >
                {getLabel(item)}
                {getSublabel?.(item) && (
                  <span className="ml-2 text-xs text-gray-400">
                    {getSublabel(item)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
