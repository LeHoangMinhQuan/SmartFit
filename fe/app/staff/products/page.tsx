"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { productService } from "../../../services/product.service";
import { adminService } from "../../../services/staff/admin.service";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import Input from "../../../components/ui/Input";
import type { PaginationMeta, Product, ProductSummary } from "../../../interfaces";

export default function StaffProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    productService
      .getProducts({ page, limit: 20, ...(search ? { q: search } : {}) })
      .then((res) => {
        setProducts(res.data);
        setMeta(res.meta);
      })
      .catch(() => toast.error("Failed to load products."))
      .finally(() => setLoading(false));
  }, [page, search]);

  async function handleDelete(product_id: number) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    try {
      await adminService.deleteProduct(product_id);
      toast.success("Product deleted.");
      setProducts((prev) => prev.filter((p) => p.product_id !== product_id));
    } catch {
      toast.error("Failed to delete product.");
    }
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage products, variants and catalog information.
          </p>
        </div>

        <button
          onClick={() => router.push("/staff/products/new")}
          className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:cursor-pointer active:translate-y-0 active:shadow-lg"
        >
          + New Product
        </button>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSearch(q);
              setPage(1);
            }
          }}
          className="w-full sm:max-w-md"
        />
        <button
          onClick={() => {
            setSearch(q);
            setPage(1);
          }}
          className="rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 hover:cursor-pointer active:bg-slate-800"
        >
          Search
        </button>
        {search && (
          <button
            onClick={() => {
              setQ("");
              setSearch("");
              setPage(1);
            }}
            className="rounded-xl border border-slate-400 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:cursor-pointer active:bg-slate-200"
          >
            Clear
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <DataTable
          columns={[
            { key: "product_id", header: "ID", className: "w-16" },
            { key: "name", header: "Name" },
            { key: "description", header: "Description" },
            {
              key: "actions",
              header: "",
              className: "w-32",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/staff/products/${row.product_id}`);
                    }}
                    className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-100 hover:cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(row.product_id as number);
                    }}
                    className="rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100 hover:cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          rows={products as unknown as Record<string, unknown>[]}
          rowKey={(row) => row.product_id as number}
          loading={loading}
          meta={meta ?? undefined}
          onPageChange={setPage}
          onRowClick={(row) =>
            router.push(`/staff/products/${row.product_id as number}`)
          }
          emptyMessage="No products found."
        />
      </div>
    </div>
  );
}
