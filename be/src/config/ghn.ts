/**
 * config/ghn.ts
 *
 * Axios clients and shared types for the GHN (Giao Hàng Nhanh) API.
 *
 * Two base clients:
 *   ghnClient      — shipping order operations  (/v2/shipping-order/*)
 *   ghnMasterClient — address master data        (/master-data/*)
 *
 * GHN Sandbox base: https://dev-online-gateway.ghn.vn
 * GHN Prod base:    https://online-gateway.ghn.vn
 *
 * Docs: https://api.ghn.vn/home/docs/detail
 *
 * TODO (production checklist):
 *   - Switch BASE_URL to the production gateway
 *   - Ensure GHN_TOKEN is a production shop token
 *   - Add GHN_FROM_DISTRICT and GHN_FROM_WARD to match your warehouse address
 */

import axios, { type AxiosInstance } from "axios";
import env from "./env.js";

// ── Base URLs ─────────────────────────────────────────────────────────────────

const BASE_URL =
  env.NODE_ENV === "production"
    ? "https://online-gateway.ghn.vn/shiip/public-api"
    : "https://dev-online-gateway.ghn.vn/shiip/public-api";

// ── Clients ───────────────────────────────────────────────────────────────────

/** Shipping order operations: create, fee, services, track, cancel */
export const ghnClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/v2`,
  headers: {
    Token: env.GHN_TOKEN,
    ShopId: String(env.GHN_SHOP_ID),
    "Content-Type": "application/json",
  },
  timeout: 10_000,
});

/** Address master data: province, district, ward */
export const ghnMasterClient: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/master-data`,
  headers: {
    Token: env.GHN_TOKEN,
    "Content-Type": "application/json",
  },
  timeout: 10_000,
});

// ── Constants ─────────────────────────────────────────────────────────────────

export const GHN_SHOP_ID = env.GHN_SHOP_ID;
export const GHN_FROM_DISTRICT = env.GHN_FROM_DISTRICT;
export const GHN_FROM_WARD = env.GHN_FROM_WARD;

// ── GHN API types ─────────────────────────────────────────────────────────────

export interface GhnService {
  service_id: number;
  short_name: string;
  service_type_id: number;
}

export interface GhnFeeResult {
  total: number;
  service_fee: number;
  insurance_fee: number;
  pick_station_fee: number;
  coupon_value: number;
  r2s_fee: number;
}

export interface GhnCreateOrderPayload {
  payment_type_id: 1 | 2; // 1 = shop pays, 2 = receiver pays
  required_note: "CHOTHUHANG" | "CHOXEMHANGKHONGTHU" | "KHONGCHOXEMHANG";
  to_name: string;
  to_phone: string;
  to_address: string;
  to_ward_code: string; // GHN ward code (NOT ward_id from our DB)
  to_district_id: number;
  weight: number; // grams
  length?: number; // cm
  width?: number; // cm
  height?: number; // cm
  service_type_id: number;
  insurance_value: number; // VND
  cod_amount: number; // 0 for prepaid orders
  note?: string;
  items: GhnOrderItem[];
}

export interface GhnOrderItem {
  name: string;
  quantity: number;
  price: number;
  weight?: number;
}

export interface GhnCreateOrderResult {
  order_code: string; // tracking_code stored in shipping_order
  total_fee: number;
  expected_delivery_time: string;
}

export interface GhnTrackingResult {
  order_code: string;
  status: string;
  updated_date: string;
  logs: Array<{ status: string; updated_date: string }>;
}

export interface GhnProvince {
  ProvinceID: number;
  ProvinceName: string;
  Code: string;
}

export interface GhnDistrict {
  DistrictID: number;
  DistrictName: string;
  ProvinceID: number;
}

export interface GhnWard {
  WardCode: string;
  WardName: string;
  DistrictID: number;
}

// ── In-memory master-data cache ───────────────────────────────────────────────
//
// Province / district / ward data changes very rarely.
// Cache it in memory and refresh once per day.

interface CacheEntry<T> {
  data: T;
  cachedAt: number; // Date.now()
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

const cache: {
  provinces?: CacheEntry<GhnProvince[]>;
  districts: Map<number, CacheEntry<GhnDistrict[]>>;
  wards: Map<number, CacheEntry<GhnWard[]>>;
} = {
  districts: new Map(),
  wards: new Map(),
};

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return entry !== undefined && Date.now() - entry.cachedAt < CACHE_TTL_MS;
}

export async function getCachedProvinces(): Promise<GhnProvince[]> {
  if (isFresh(cache.provinces)) return cache.provinces.data;
  const res = await ghnMasterClient.get<{ data: GhnProvince[] }>("/province");
  cache.provinces = { data: res.data.data, cachedAt: Date.now() };
  return cache.provinces.data;
}

export async function getCachedDistricts(
  provinceId: number,
): Promise<GhnDistrict[]> {
  const cached = cache.districts.get(provinceId);
  if (isFresh(cached)) return cached.data;
  const res = await ghnMasterClient.post<{ data: GhnDistrict[] }>("/district", {
    province_id: provinceId,
  });
  cache.districts.set(provinceId, {
    data: res.data.data,
    cachedAt: Date.now(),
  });
  return res.data.data;
}

export async function getCachedWards(districtId: number): Promise<GhnWard[]> {
  const cached = cache.wards.get(districtId);
  if (isFresh(cached)) return cached.data;
  const res = await ghnMasterClient.post<{ data: GhnWard[] }>("/ward", {
    district_id: districtId,
  });
  cache.wards.set(districtId, { data: res.data.data, cachedAt: Date.now() });
  return res.data.data;
}
