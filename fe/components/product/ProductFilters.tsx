"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import Input from "../ui/Input";

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
    <aside className="w-52 shrink-0 flex flex-col gap-5 border border-white rounded-lg p-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-gray-200">Price range</p>
        <div className="flex flex-col gap-2">
          <Input
            className="bg-gray-200 placeholder:text-gray-500 text-black"
            type="number"
            placeholder="Min"
            min={0}
            defaultValue={params.get("minPrice") ?? ""}
            onBlur={(e) => update("minPrice", e.target.value)}
          />
          <Input
            className="bg-gray-200 placeholder:text-gray-500 text-black"
            type="number"
            placeholder="Max"
            min={0}
            defaultValue={params.get("maxPrice") ?? ""}
            onBlur={(e) => update("maxPrice", e.target.value)}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-gray-200">Sort</p>
        <select
          value={params.get("sort") ?? ""}
          onChange={(e) => update("sort", e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-200 placeholder:text-gray-500 text-black"
        >
          <option value="">Default</option>
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <button
        onClick={() => router.push("?")}
        className="self-center w-full text-sm bg-blue-300 text-black hover:cursor-pointer border border-white rounded-lg p-2 transition-colors hover:bg-blue-400"
      >
        Clear all filters
      </button>
    </aside>
  );
}
