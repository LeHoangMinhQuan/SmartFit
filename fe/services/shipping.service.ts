import api from "../lib/axios";
import type { District, Province, ShippingLog, Ward } from "../interfaces";

interface ServicesBody {
  from_district_id: number;
  to_district_id: number;
}

interface FeeBody {
  service_id: number;
  from_district_id: number;
  to_district_id: number;
  to_ward_code: string;
  weight: number; // grams
  length?: number;
  width?: number;
  height?: number;
}

interface ShippingService {
  service_id: number;
  short_name: string;
  service_type_id: number;
}

interface FeeEstimate {
  total: number;
  service_fee: number;
}

export const shippingService = {
  // Province/district/ward data comes from local DB (seeded from GHN).
  // Filter out districts where supporttype = 0 or status != 1 in the UI.
  getProvinces: () =>
    api.get<Province[]>("/shipping/provinces").then((r) => r.data),

  getDistricts: (province_id: number) =>
    api
      .get<District[]>(`/shipping/districts/${province_id}`)
      .then((r) => r.data),

  getWards: (district_id: number) =>
    api.get<Ward[]>(`/shipping/wards/${district_id}`).then((r) => r.data),

  // Available GHN service tiers for the given route
  getServices: (body: ServicesBody) =>
    api
      .post<ShippingService[]>("/shipping/services", body)
      .then((r) => r.data),

  // Estimated fee for a specific service + parcel dimensions
  estimateFee: (body: FeeBody) =>
    api.post<FeeEstimate>("/shipping/fee", body).then((r) => r.data),

  // Latest row from shipping_logs for a given tracking code
  trackOrder: (tracking_code: string) =>
    api
      .get<ShippingLog[]>(`/shipping/track/${tracking_code}`)
      .then((r) => r.data),
};
