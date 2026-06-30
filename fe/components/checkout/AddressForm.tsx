"use client";

import { useEffect, useState } from "react";
import { shippingService } from "../../services/shipping.service";
import Input from "../ui/Input";
import type { District, Province, Ward } from "../../interfaces";

export interface AddressFormValues {
  address_line: string; // VARCHAR(20) — max 20 chars
  province_id: number;
  district_id: number;
  ward_id: number;
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
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);

  useEffect(() => {
    shippingService.getProvinces().then(setProvinces);
  }, []);

  useEffect(() => {
    if (!value.province_id) {
      setDistricts([]);
      setWards([]);
      return;
    }
    shippingService.getDistricts(value.province_id).then((data) => {
      // Filter GHN-locked districts: supporttype === 0 means no delivery
      setDistricts(data.filter((d) => d.status === 1 && d.supporttype !== 0));
      setWards([]);
      onChange({ ...value, district_id: undefined, ward_id: undefined });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.province_id]);

  useEffect(() => {
    if (!value.district_id) {
      setWards([]);
      return;
    }
    shippingService.getWards(value.district_id).then((data) => {
      // Filter GHN-locked wards
      setWards(data.filter((w) => w.status === 1 && w.supporttype !== 0));
      onChange({ ...value, ward_id: undefined });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.district_id]);

  const set = (key: keyof AddressFormValues, v: unknown) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Address line"
        value={value.address_line ?? ""}
        onChange={(e) => set("address_line", e.target.value)}
        maxLength={20}
        hint="Street number and name — max 20 characters"
        error={errors?.address_line}
        required
      />

      {/* Province */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Province</label>
        <select
          value={value.province_id ?? ""}
          onChange={(e) => set("province_id", Number(e.target.value))}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">District</label>
        <select
          value={value.district_id ?? ""}
          onChange={(e) => set("district_id", Number(e.target.value))}
          disabled={!value.province_id || !districts.length}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
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
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Ward</label>
        <select
          value={value.ward_id ?? ""}
          onChange={(e) => set("ward_id", Number(e.target.value))}
          disabled={!value.district_id || !wards.length}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
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

      <Input
        label="Label (optional)"
        placeholder="e.g. Home, Office"
        value={value.label ?? ""}
        onChange={(e) => set("label", e.target.value)}
        maxLength={20}
        hint="Max 20 characters"
        error={errors?.label}
      />

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={value.is_default ?? false}
          onChange={(e) => set("is_default", e.target.checked)}
          className="rounded"
        />
        Set as default address
      </label>
    </div>
  );
}
