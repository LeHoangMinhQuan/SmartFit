import { ApiError } from "../utils/ApiError.js";
import * as OrderModel from "../models/order.model.js";
import * as ShippingModel from "../models/shipping.model.js";
import { ghnClient } from "../config/ghn.js";

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
  const order = await OrderModel.findOrderById(order_id);
  if (!order) throw new Error(`Order ${order_id} not found`);

  const items = await OrderModel.findOrderItems(order_id);

  const payload = {
    payment_type_id: 2, // recipient pays
    note: "",
    required_note: "CHOXEMHANGKHONG",
    to_name: "Customer",
    to_phone: "0900000000",
    to_address: order.shipping_address,
    to_ward_code: String(order.ward_id ?? ""),
    to_district_id: order.district_id ?? 0,
    weight: 500, // default 500g — extend with product weight later
    length: 20,
    width: 20,
    height: 10,
    service_type_id: 2, // standard
    items: items.map((i: any) => ({
      name: i.product_name ?? `Product ${i.product_id}`,
      quantity: i.quantity,
      price: Number(i.unit_price),
    })),
  };

  const { data } = await ghnClient.post("/v2/shipping-order/create", payload);
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

export async function estimateFee(body: {
  service_id: number;
  from_district_id: number;
  to_district_id: number;
  to_ward_code: string;
  weight: number;
}) {
  const { data } = await ghnClient.get("/v2/shipping-order/fee", {
    params: body,
  });
  return data.data;
}

// ─── Available services ───────────────────────────────────────────────────────

export async function getAvailableServices(
  from_district: number,
  to_district: number,
) {
  const { data } = await ghnClient.post(
    "/v2/shipping-order/available-services",
    {
      shop_id: Number(process.env.GHN_SHOP_ID ?? 0),
      from_district,
      to_district,
    },
  );
  return data.data;
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

// ─── GHN Webhook ─────────────────────────────────────────────────────────────

export async function handleWebhook(body: {
  OrderCode: string;
  Status: string;
}) {
  const { OrderCode: tracking_code, Status: ghnStatus } = body;

  const shipment =
    await ShippingModel.findShippingOrderByTrackingCode(tracking_code);
  if (!shipment) {
    console.warn(`[GHN Webhook] Unknown tracking code: ${tracking_code}`);
    return;
  }

  // Map + enforce ≤10 chars before insert
  await ShippingModel.insertShippingLog(shipment.shipping_order_id, ghnStatus);

  // If delivered, update order status
  const mapped = ShippingModel.mapGhnStatus(ghnStatus);
  if (mapped === "delivered") {
    await OrderModel.updateOrderStatus(shipment.order_id, "delivered");
  }
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
