import api from "../lib/axios";
import type { District, Province, ShippingLog, Ward } from "../interfaces";

interface ServicesBody {
  to_district_id: number;
}

interface FeeBody {
  service_id: number;
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

interface AutoSelectBody {
  to_district_id: number;
  to_ward_code: string;
}

interface AutoSelectResult {
  service_id: number;
  short_name: string;
  fee: number;
  parcel: { weight: number; length: number; width: number; height: number };
}

// Every endpoint below wraps its payload in { data: result } on the
// backend (see controllers/shipping.controller.ts). These calls were
// previously resolving with `r.data` (the whole { data: ... } envelope
// object) instead of `r.data.data` (the actual payload) — e.g.
// getProvinces() resolved to { data: [...] } rather than [...], which
// crashed AddressForm.tsx's provinces.map() the same way cartItems.reduce
// is not a function did before cart.service.ts was fixed.
export const shippingService = {
  // Province/district/ward data comes from local DB (seeded from GHN).
  // Filter out districts where supporttype = 0 or status != 1 in the UI.
  getProvinces: () =>
    api
      .get<{ data: Province[] }>("/shipping/provinces")
      .then((r) => r.data.data),

  getDistricts: (province_id: number) =>
    api
      .get<{ data: District[] }>(`/shipping/districts/${province_id}`)
      .then((r) => r.data.data),

  getWards: (district_id: number) =>
    api
      .get<{ data: Ward[] }>(`/shipping/wards/${district_id}`)
      .then((r) => r.data.data),

  // Available GHN service tiers for the given route. `from_district_id` is
  // intentionally NOT sent — the backend always uses its own GHN_FROM_DISTRICT
  // (the shop's actual registered pickup point). Sending a client-guessed
  // "from" district here previously caused GHN to silently return an empty
  // service list whenever it didn't match the shop's real registration.
  getServices: (body: ServicesBody) =>
    api
      .post<{ data: ShippingService[] }>("/shipping/services", body)
      .then((r) => r.data.data),

  // Estimated fee for a specific service + parcel dimensions. Same note as
  // above — no from_district_id/from_ward_code, the backend supplies those.
  estimateFee: (body: FeeBody) =>
    api
      .post<{ data: FeeEstimate }>("/shipping/fee", body)
      .then((r) => r.data.data),

  // Picks the GHN service tier (light vs heavy goods) for the caller's
  // current cart automatically — see services/ghn.service.ts on the
  // backend for why this isn't a manual customer choice.
  autoSelectService: (body: AutoSelectBody) =>
    api
      .post<{ data: AutoSelectResult }>("/shipping/auto-select", body)
      .then((r) => r.data.data),

  // Latest row from shipping_logs for a given tracking code
  trackOrder: (tracking_code: string) =>
    api
      .get<{ data: ShippingLog[] }>(`/shipping/track/${tracking_code}`)
      .then((r) => r.data.data),
};
