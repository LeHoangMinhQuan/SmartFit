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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <button
          onClick={() => router.push("/staff/products/new")}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
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
          className="max-w-xs"
        />
        <button
          onClick={() => {
            setSearch(q);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
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
            className="text-sm text-gray-400 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

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
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/staff/products/${row.product_id}`);
                  }}
                  className="text-xs text-blue-500 hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(row.product_id as number);
                  }}
                  className="text-xs text-red-500 hover:underline"
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
  );
}
