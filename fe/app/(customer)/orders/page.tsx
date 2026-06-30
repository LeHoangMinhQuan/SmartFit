"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { orderService } from "../../../services/order.service";
import { useAuthStore } from "../../../store/useAuthStore";
import OrderCard from "../../../components/order/OrderCard";
import Pagination from "../../../components/ui/Pagination";
import Spinner from "../../../components/ui/Spinner";
import type { Order, PaginationMeta } from "../../../interfaces";

export default function OrdersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Guests can't view order history
  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    orderService
      .getOrders({ page, limit: 10 })
      .then((res) => {
        setOrders(res.data);
        setMeta(res.meta);
      })
      .finally(() => setLoading(false));
  }, [user, page]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold">My Orders</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : orders.length === 0 ? (
        <p className="py-16 text-center text-gray-500">
          You haven&rsquo;t placed any orders yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => (
            <OrderCard key={o.order_id} order={o} />
          ))}

          {meta && (
            <div className="mt-4 flex justify-center">
              <Pagination meta={meta} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
