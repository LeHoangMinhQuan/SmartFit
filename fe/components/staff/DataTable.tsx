"use client";

import { clsx } from "clsx";
import Spinner from "../ui/Spinner";
import Pagination from "../ui/Pagination";
import type { PaginationMeta } from "../../interfaces";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  // Render the cell. Defaults to String(row[key]) if omitted and key matches a row property.
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  meta?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  loading,
  emptyMessage = "No records found.",
  meta,
  onPageChange,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx("px-6 py-4 align-middle", col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  <Spinner className="mx-auto" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center py-16">
                    <div className="mb-3 text-5xl">📦</div>

                    <p className="font-medium text-slate-700">{emptyMessage}</p>

                    <p className="mt-1 text-sm text-slate-400">
                      There are no items to display.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={clsx(
                    "border-b border-slate-100 transition-colors duration-200 last:border-0",
                    onRowClick && "cursor-pointer hover:bg-slate-50",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        "px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500",
                        col.className,
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : String(row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta && onPageChange && (
        <div className="flex justify-center">
          <Pagination meta={meta} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}
