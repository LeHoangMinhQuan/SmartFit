"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { shippingService } from "../../services/shipping.service";
import Input from "../ui/Input";

export interface AddressFormValues {
  address_line: string; // VARCHAR(20) — max 20 chars
  province_id: number;
  district_id: number;
  ward_id: number;
  // Captured alongside their ids below so the parent (checkout, address
  // book) can build a full concatenated address without a second lookup —
  // see lib/utils.ts#formatFullAddress.
  province_name?: string;
  district_name?: string;
  ward_name?: string;
  label: string; // VARCHAR(20) — max 20 chars
  is_default: boolean;
}

interface AddressFormProps {
  value: Partial<AddressFormValues>;
  onChange: (v: Partial<AddressFormValues>) => void;
  errors?: Partial<Record<keyof AddressFormValues, string>>;
}

export default function AddressForm({
  value,
  onChange,
  errors,
}: AddressFormProps) {
  const { data: provinces = [] } = useQuery({
    queryKey: ["shipping", "provinces"],
    queryFn: () => shippingService.getProvinces(),
    // Reference data — safe to keep around indefinitely once fetched.
    staleTime: Infinity,
  });

  const { data: rawDistricts } = useQuery({
    queryKey: ["shipping", "districts", value.province_id],
    queryFn: () => shippingService.getDistricts(value.province_id as number),
    enabled: !!value.province_id,
    staleTime: Infinity,
  });
  // Filter GHN-locked districts: supporttype === 0 means no delivery
  const districts = (rawDistricts ?? []).filter(
    (d) => d.status === 1 && d.supporttype !== 0,
  );

  const { data: rawWards } = useQuery({
    queryKey: ["shipping", "wards", value.district_id],
    queryFn: () => shippingService.getWards(value.district_id as number),
    enabled: !!value.district_id,
    staleTime: Infinity,
  });
  // Filter GHN-locked wards
  const wards = (rawWards ?? []).filter(
    (w) => w.status === 1 && w.supporttype !== 0,
  );

  // Clear the downstream selection whenever its parent selection changes —
  // mirrors the original effects, which reset district/ward on province
  // change and ward on district change.
  useEffect(() => {
    if (value.district_id !== undefined || value.ward_id !== undefined) {
      onChange({
        ...value,
        district_id: undefined,
        district_name: undefined,
        ward_id: undefined,
        ward_name: undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.province_id]);

  useEffect(() => {
    if (value.ward_id !== undefined) {
      onChange({ ...value, ward_id: undefined, ward_name: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.district_id]);

  const set = (key: keyof AddressFormValues, v: unknown) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Address line"
        value={value.address_line ?? ""}
        onChange={(e) => set("address_line", e.target.value)}
        maxLength={20}
        hint="House number & Street name — max 20 characters"
        error={errors?.address_line}
        required
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* Province */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-900">
            Province
          </label>
          <select
            value={value.province_id ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              const match = provinces.find((p) => p.province_id === id);
              onChange({
                ...value,
                province_id: id,
                province_name: match?.province_name,
              });
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          >
            <option value="">Select province…</option>
            {provinces.map((p) => (
              <option key={p.province_id} value={p.province_id}>
                {p.province_name}
              </option>
            ))}
          </select>
          {errors?.province_id && (
            <p className="text-xs text-red-500">{errors.province_id}</p>
          )}
        </div>

        {/* District */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-900">
            District
          </label>
          <select
            value={value.district_id ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              const match = districts.find((d) => d.district_id === id);
              onChange({
                ...value,
                district_id: id,
                district_name: match?.district_name,
              });
            }}
            disabled={!value.province_id || !districts.length}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            required
          >
            <option value="">Select district…</option>
            {districts.map((d) => (
              <option key={d.district_id} value={d.district_id}>
                {d.district_name}
              </option>
            ))}
          </select>
          {errors?.district_id && (
            <p className="text-xs text-red-500">{errors.district_id}</p>
          )}
        </div>

        {/* Ward */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-900">Ward</label>
          <select
            value={value.ward_id ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              const match = wards.find((w) => w.ward_id === id);
              onChange({
                ...value,
                ward_id: id,
                ward_name: match?.ward_name,
              });
            }}
            disabled={!value.district_id || !wards.length}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            required
          >
            <option value="">Select ward…</option>
            {wards.map((w) => (
              <option key={w.ward_id} value={w.ward_id}>
                {w.ward_name}
              </option>
            ))}
          </select>
          {errors?.ward_id && (
            <p className="text-xs text-red-500">{errors.ward_id}</p>
          )}
        </div>
      </div>

      <Input
        label="Label (optional)"
        placeholder="e.g. Home, Office"
        value={value.label ?? ""}
        onChange={(e) => set("label", e.target.value)}
        maxLength={20}
        hint="Max 20 characters"
        error={errors?.label}
      />

      <label className="mt-1 flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700 hover:text-slate-900">
        <input
          type="checkbox"
          checked={value.is_default ?? false}
          onChange={(e) => set("is_default", e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 focus:ring-indigo-500"
        />
        Set as default address
      </label>
    </div>
  );
}
