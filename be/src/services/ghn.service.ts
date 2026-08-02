import { ApiError } from "../utils/ApiError.js";
import * as OrderModel from "../models/order.model.js";
import * as ShippingModel from "../models/shipping.model.js";
import * as CartModel from "../models/cart.model.js";
import { ghnClient } from "../config/ghn.js";
import { env } from "../config/env.js";

// ─── Parcel sizing (real product dimensions, not a hardcoded guess) ───────────
//
// Falls back to this per-item placeholder for products that haven't had
// their real weight/dimensions configured yet (product.weight_grams/
// length_cm/width_cm/height_cm — nullable, see product.schema.ts).
const PLACEHOLDER_ITEM_PARCEL = {
  weight_grams: 500,
  length_cm: 20,
  width_cm: 20,
  height_cm: 10,
};

interface ParcelItemInput {
  quantity: number;
  weight_grams?: number | string | null;
  length_cm?: number | string | null;
  width_cm?: number | string | null;
  height_cm?: number | string | null;
}

/**
 * Computes one combined parcel (weight + box dimensions) for a set of
 * cart/order line items, using each product's real configured shipping
 * dimensions where available. Used for both fee/service estimation
 * (estimateFee, autoSelectService) and actual shipment creation
 * (createShipmentForOrder) — they must agree, or GHN could charge
 * differently than what was quoted at checkout.
 *
 * Heuristic (not true bin-packing — plenty for a thesis-scale catalog):
 * items are assumed to stack in a single box, so weight sums across all
 * items, height sums (stacked), and length/width take the largest single
 * item's footprint.
 */
export function getParcelForItems(items: ParcelItemInput[]) {
  let weight = 0;
  let length = 0;
  let width = 0;
  let height = 0;

  for (const item of items) {
    const w = Number(item.weight_grams) || PLACEHOLDER_ITEM_PARCEL.weight_grams;
    const l = Number(item.length_cm) || PLACEHOLDER_ITEM_PARCEL.length_cm;
    const wd = Number(item.width_cm) || PLACEHOLDER_ITEM_PARCEL.width_cm;
    const h = Number(item.height_cm) || PLACEHOLDER_ITEM_PARCEL.height_cm;

    weight += w * item.quantity;
    length = Math.max(length, l);
    width = Math.max(width, wd);
    height += h * item.quantity;
  }

  // GHN rejects zero/undersized parcels — clamp to sane minimums.
  return {
    weight: Math.max(Math.round(weight), 1),
    length: Math.max(Math.round(length), 1),
    width: Math.max(Math.round(width), 1),
    height: Math.max(Math.round(height), 1),
  };
}

// ─── Simple in-memory location cache (daily TTL) ──────────────────────────────
const cache = new Map<string, { data: any; expires: number }>();

function fromCache(key: string) {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data;
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, expires: Date.now() + 24 * 60 * 60 * 1000 });
}

// ─── Shipment creation (triggered from IPN after payment) ─────────────────────

export async function createShipmentForOrder(order_id: number) {
  const order = await OrderModel.findOrderWithCustomerInfo(order_id);
  if (!order) throw new Error(`Order ${order_id} not found`);

  const items = await OrderModel.findOrderItems(order_id);
  const parcel = getParcelForItems(items);

  const isCOD = order.payment_method_name.toLowerCase() === "cod";

  const payload = {
    payment_type_id: 2, // recipient pays the shipping fee (see comment above)
    // cod_amount is a SEPARATE concept from payment_type_id — this is the
    // cash GHN should actually collect from the recipient for the ORDER
    // itself. Previously never set at all, meaning even genuine COD
    // orders had no money collected on delivery. 0 for prepaid orders
    // (nothing to collect — already paid via VNPay).
    cod_amount: isCOD ? Number(order.total_amount) : 0,
    note: "",
    required_note: "CHOXEMHANGKHONG",
    from_district_id: Number(env.GHN_FROM_DISTRICT),
    from_ward_code: env.GHN_FROM_WARD,
    // Previously hardcoded to "Customer" / "0900000000" for every
    // shipment — a real courier can't reach a placeholder phone number
    // to arrange delivery, and can't collect COD cash from "Customer".
    to_name: order.customer_name,
    to_phone: order.customer_phone,
    to_address: order.shipping_address,
    to_ward_code: String(order.ward_id ?? ""),
    to_district_id: order.district_id ?? 0,
    weight: parcel.weight,
    length: parcel.length,
    width: parcel.width,
    height: parcel.height,
    service_type_id: 2, // standard
    items: items.map((i: any) => ({
      name: i.product_name ?? `Product ${i.product_id}`,
      quantity: i.quantity,
      price: Number(i.unit_price),
    })),
  };

  const { data } = await ghnClient.post("/shipping-order/create", payload);
  const ghnOrder = data.data;

  // Insert shipping_order (IDENTITY — do not supply shipping_order_id)
  const shipping_order_id = await ShippingModel.createShippingOrder({
    order_id,
    tracking_code: ghnOrder.order_code,
    shipping_fee: Number(ghnOrder.total_fee ?? 0),
    service_id: null,
  });

  // Update ORDER.shipping_order_id (circular FK resolved — ORDER created first with NULL)
  await OrderModel.setOrderShippingId(order_id, shipping_order_id);

  // Log initial status
  await ShippingModel.insertShippingLog(shipping_order_id, "ready_to_pick");

  return { shipping_order_id, tracking_code: ghnOrder.order_code };
}

// ─── Fee estimation ───────────────────────────────────────────────────────────

// `from_district_id`/`from_ward_code` are deliberately NOT accepted from the
// caller — they must always be the shop's own registered pickup point
// (env.GHN_FROM_DISTRICT/GHN_FROM_WARD), never client-supplied. GHN validates
// that `shop_id` can actually ship from the given `from_district`/`from_ward`
// and silently returns an empty result (not an error) on mismatch — this is
// what caused "no delivery services available" when the frontend was sending
// its own guessed district (NEXT_PUBLIC_STORE_DISTRICT_ID) instead.
export async function estimateFee(body: {
  service_id: number;
  to_district_id: number;
  to_ward_code: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
}) {
  const { data } = await ghnClient.get("/shipping-order/fee", {
    params: {
      ...body,
      from_district_id: Number(env.GHN_FROM_DISTRICT),
      from_ward_code: env.GHN_FROM_WARD,
    },
  });
  return data.data;
}

// ─── Available services ───────────────────────────────────────────────────────

export async function getAvailableServices(to_district: number) {
  const { data } = await ghnClient.post("/shipping-order/available-services", {
    shop_id: Number(env.GHN_SHOP_ID),
    from_district: Number(env.GHN_FROM_DISTRICT),
    to_district,
  });
  return data.data;
}

/**
 * Auto-selects a shipping service for the current user's cart, instead of
 * asking the customer to manually pick between GHN's tiers — those tiers
 * ("Hàng nhẹ" / light vs "Hàng nặng" / heavy, see the sample response in
 * getAvailableServices) are a weight/size classification GHN enforces
 * server-side, not a delivery-speed preference like "standard vs express".
 * A customer has no real basis to choose between them.
 *
 * Computes the real parcel size from the cart's product dimensions
 * (getParcelForItems), then tries each service GHN offers for this route
 * and returns the first one that actually accepts/quotes that parcel.
 */
export async function autoSelectService(
  user_id: number,
  to_district_id: number,
  to_ward_code: string,
) {
  const { items } = await CartModel.getCartWithItems(user_id);
  if (!items.length) {
    throw new ApiError(400, "Your cart is empty.");
  }

  const parcel = getParcelForItems(items);
  const services = await getAvailableServices(to_district_id);

  for (const svc of services) {
    try {
      const fee = await estimateFee({
        service_id: svc.service_id,
        to_district_id,
        to_ward_code,
        weight: parcel.weight,
        length: parcel.length,
        width: parcel.width,
        height: parcel.height,
      });
      return {
        service_id: svc.service_id,
        short_name: svc.short_name,
        fee: fee.total,
        parcel,
      };
    } catch {
      // GHN rejected this tier for this parcel/route (e.g. the "light
      // goods" service can't carry this weight) — fall through and try
      // the next tier rather than failing the whole request.
      continue;
    }
  }

  throw new ApiError(
    422,
    "No shipping service is available for this address and order.",
  );
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

export async function trackOrder(tracking_code: string) {
  const shipment =
    await ShippingModel.findShippingOrderByTrackingCode(tracking_code);
  if (!shipment) throw new ApiError(404, "Tracking code not found");

  const log = await ShippingModel.getLatestShippingLog(
    shipment.shipping_order_id,
  );
  return { ...shipment, latest_status: log?.status ?? null };
}

// ─── Location data (cached) ───────────────────────────────────────────────────

export async function getProvinces() {
  const cached = fromCache("provinces");
  if (cached) return cached;
  const data = await ShippingModel.findAllProvinces();
  setCache("provinces", data);
  return data;
}

export async function getDistricts(province_id: number) {
  const key = `districts:${province_id}`;
  const cached = fromCache(key);
  if (cached) return cached;
  const data = await ShippingModel.findDistrictsByProvince(province_id);
  setCache(key, data);
  return data;
}

export async function getWards(district_id: number) {
  const key = `wards:${district_id}`;
  const cached = fromCache(key);
  if (cached) return cached;
  const data = await ShippingModel.findWardsByDistrict(district_id);
  setCache(key, data);
  return data;
}
