"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { shippingService } from "../../services/shipping.service";
import { formatPrice } from "../../lib/utils";
import Spinner from "../ui/Spinner";
import { Truck } from "lucide-react";

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
  // GHN's "services" for a route are a weight/size classification (light
  // goods vs heavy goods — see the sample response in
  // services/ghn.service.ts on the backend), not a delivery-speed choice
  // like standard vs express. The customer has no real basis to pick
  // between them, so the backend now picks whichever tier the actual
  // cart's real weight/dimensions qualify for.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["shipping", "auto-select", toDistrictId, toWardCode],
    queryFn: () =>
      shippingService.autoSelectService({
        to_district_id: toDistrictId as number,
        to_ward_code: toWardCode as string,
      }),
    enabled: !!toDistrictId && !!toWardCode,
    retry: false,
  });

  // Report the auto-selected service up to the parent (checkout) once it
  // resolves, so it can be included in order creation without the
  // customer needing to interact with this component at all.
  const lastReported = useRef<number | null>(null);
  useEffect(() => {
    if (!data) return;
    if (lastReported.current === data.service_id) return;
    lastReported.current = data.service_id;
    onSelect(data.service_id, data.fee);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!toDistrictId || !toWardCode) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Spinner size="sm" />
        Finding the best shipping method for your order…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-gray-500">
        No shipping service available for this address and order.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700">Shipping method</p>
      <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 p-3">
        <div className="flex items-center gap-3">
          <Truck className="h-4 w-4 text-gray-500" />
          <div>
            <span className="text-sm text-gray-700">{data.short_name}</span>
            <p className="text-xs text-gray-400">
              Automatically selected based on your order
            </p>
          </div>
        </div>
        <span className="text-sm font-medium text-gray-700">
          {formatPrice(data.fee)}
        </span>
      </div>
      {selectedServiceId !== data.service_id && (
        <p className="text-xs text-amber-600">Updating shipping method…</p>
      )}
    </div>
  );
}
