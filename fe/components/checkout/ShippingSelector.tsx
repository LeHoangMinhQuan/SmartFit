"use client";

import { useEffect, useState } from "react";
import { shippingService } from "../../services/shipping.service";
import { formatPrice } from "../../lib/utils";
import Spinner from "../ui/Spinner";

interface ShippingService {
  service_id: number;
  short_name: string;
  service_type_id: number;
}

interface ShippingSelectorProps {
  fromDistrictId: number | null;
  toDistrictId: number | null;
  toWardCode: string | null;
  selectedServiceId: number | null;
  onSelect: (service_id: number, fee: number) => void;
}

export default function ShippingSelector({
  fromDistrictId,
  toDistrictId,
  toWardCode,
  selectedServiceId,
  onSelect,
}: ShippingSelectorProps) {
  const [services, setServices] = useState<ShippingService[]>([]);
  const [fees, setFees] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fromDistrictId || !toDistrictId || !toWardCode) return;
    setLoading(true);
    shippingService
      .getServices({
        from_district_id: fromDistrictId,
        to_district_id: toDistrictId,
      })
      .then(async (svcs) => {
        setServices(svcs);
        // Fetch fees for all services in parallel
        const feeResults = await Promise.all(
          svcs.map((s) =>
            shippingService
              .estimateFee({
                service_id: s.service_id,
                from_district_id: fromDistrictId,
                to_district_id: toDistrictId,
                to_ward_code: toWardCode?.toString() || "",
                weight: 500, // default 500g — refine if product weight is known
              })
              .then((r) => [s.service_id, r.total] as [number, number]),
          ),
        );
        setFees(Object.fromEntries(feeResults));
      })
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [fromDistrictId, toDistrictId, toWardCode]);

  if (!fromDistrictId || !toDistrictId || !toWardCode) return null;
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
            <span className="text-sm">{s.short_name}</span>
          </div>
          <span className="text-sm font-medium">
            {fees[s.service_id] !== undefined
              ? formatPrice(fees[s.service_id])
              : "…"}
          </span>
        </label>
      ))}
    </div>
  );
}
