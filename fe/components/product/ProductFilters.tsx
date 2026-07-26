"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import Input from "../ui/Input";
import { SlidersHorizontal, FilterX } from "lucide-react";

export default function ProductFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.set("page", "1"); // reset to page 1 on any filter change
      router.push(`?${next.toString()}`);
    },
    [params, router],
  );

  return (
    <aside className="flex w-full flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
        <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
        <h2 className="text-base font-bold text-slate-900">Filters</h2>
      </div>

      {/* Price Range */}
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-800">Price Range</p>
        <div className="flex flex-col gap-3">
          <Input
            className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500/20"
            type="number"
            placeholder="Min price"
            min={0}
            defaultValue={params.get("minPrice") ?? ""}
            onBlur={(e) => update("minPrice", e.target.value)}
          />
          <Input
            className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-indigo-500/20"
            type="number"
            placeholder="Max price"
            min={0}
            defaultValue={params.get("maxPrice") ?? ""}
            onBlur={(e) => update("maxPrice", e.target.value)}
          />
        </div>
      </div>

      {/* Sort */}
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-800">Sort By</p>
        <div className="relative">
          <select
            value={params.get("sort") ?? ""}
            onChange={(e) => update("sort", e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 hover:cursor-pointer"
          >
            <option value="">Default sorting</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="newest">Newest Arrivals</option>
          </select>
          {/* Custom dropdown arrow to match the theme */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Clear Button */}
      <button
        onClick={() => router.push("?")}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900 active:scale-[0.98] hover:cursor-pointer"
      >
        <FilterX className="h-4 w-4" />
        Clear all filters
      </button>
    </aside>
  );
}
