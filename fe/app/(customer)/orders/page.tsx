"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { orderService } from "../../../services/order.service";
import { useAuthStore } from "../../../store/useAuthStore";
import OrderCard from "../../../components/order/OrderCard";
import Pagination from "../../../components/ui/Pagination";
import Spinner from "../../../components/ui/Spinner";

export default function OrdersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [page, setPage] = useState(1);

  // Guests can't view order history
  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) router.replace("/");
  }, [hasHydrated, user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["orders", user?.user_id, page],
    queryFn: () => orderService.getOrders({ page, limit: 10 }),
    enabled: hasHydrated && !!user,
    placeholderData: keepPreviousData,
  });
  const loading = !hasHydrated || isLoading;

  const orders = data?.data ?? [];
  const meta = data?.meta ?? null;

  if (!hasHydrated) return null;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">My Orders</h1>

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
