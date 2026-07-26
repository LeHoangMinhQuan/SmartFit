"use client";

import { useQuery } from "@tanstack/react-query";
import { shippingService } from "../../services/shipping.service";
import { formatPrice } from "../../lib/utils";
import Spinner from "../ui/Spinner";

interface ShippingSelectorProps {
  toDistrictId: number | null;
  toWardCode: string | null;
  selectedServiceId: number | null;
  onSelect: (service_id: number, fee: number) => void;
}

export default function ShippingSelector({
  toDistrictId,
  toWardCode,
  selectedServiceId,
  onSelect,
}: ShippingSelectorProps) {
  const { data, isLoading: loading } = useQuery({
    queryKey: ["shipping", "services", toDistrictId, toWardCode],
    queryFn: async () => {
      const svcs = await shippingService.getServices({
        to_district_id: toDistrictId as number,
      });

      // Fetch fees independently — a service tier GHN can't quote for this
      // parcel (e.g. a "heavy" tier rejecting our placeholder 500g weight)
      // must not take the other, quotable tiers down with it. Promise.all
      // previously failed the whole batch on a single rejection, wiping
      // out services the UI had already shown.
      const results = await Promise.allSettled(
        svcs.map((s) =>
          shippingService
            .estimateFee({
              service_id: s.service_id,
              to_district_id: toDistrictId as number,
              to_ward_code: toWardCode?.toString() || "",
              weight: 500, // default 500g — refine if product weight is known
            })
            .then((r) => [s.service_id, r.total] as [number, number]),
        ),
      );

      const quotable = new Set<number>();
      const feeEntries: [number, number][] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          feeEntries.push(result.value);
          quotable.add(result.value[0]);
        }
      }

      // Only render services GHN actually priced — a service with no fee
      // would otherwise sit stuck on "…" forever and be unselectable.
      return {
        services: svcs.filter((s) => quotable.has(s.service_id)),
        fees: Object.fromEntries(feeEntries) as Record<number, number>,
      };
    },
    enabled: !!toDistrictId && !!toWardCode,
  });

  const services = data?.services ?? [];
  const fees = data?.fees ?? {};

  if (!toDistrictId || !toWardCode) return null;
  if (loading) return <Spinner size="sm" />;
  if (!services.length)
    return (
      <p className="text-sm text-gray-500">
        No shipping services available for this address.
      </p>
    );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700">Shipping method</p>
      {services.map((s) => (
        <label
          key={s.service_id}
          className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:border-gray-400"
        >
          <div className="flex items-center gap-3">
            <input
              type="radio"
              name="shipping_service"
              value={s.service_id}
              checked={selectedServiceId === s.service_id}
              onChange={() => onSelect(s.service_id, fees[s.service_id] ?? 0)}
            />
            <span className="text-sm text-gray-700">{s.short_name}</span>
          </div>
          <span className="text-sm font-medium text-gray-700">
            {fees[s.service_id] !== undefined
              ? formatPrice(fees[s.service_id])
              : "…"}
          </span>
        </label>
      ))}
    </div>
  );
}
