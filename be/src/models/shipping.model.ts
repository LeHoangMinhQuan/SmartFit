import db from "../config/db.js";

// ─── Status Mapping (GHN → DB max 10 chars) ──────────────────────────────────

const GHN_STATUS_MAP: Record<string, string> = {
  ready_to_pick: "picking",
  picking: "picking",
  delivering: "delivering",
  delivered: "delivered",
  return: "return",
  cancelled: "cancelled",
  // fallback: truncate to 10
};

export function mapGhnStatus(ghnStatus: string): string {
  const mapped = GHN_STATUS_MAP[ghnStatus.toLowerCase()];
  if (mapped) return mapped;
  // Safety: truncate to 10 chars if unknown
  return ghnStatus.slice(0, 10);
}

// ─── Shipping Order ───────────────────────────────────────────────────────────

export interface ShippingOrderData {
  order_id: number;
  tracking_code: string;
  shipping_fee: number;
  service_id?: number | null;
}

export async function createShippingOrder(
  data: ShippingOrderData,
): Promise<number> {
  const [row] = await db("shipping_order")
    .insert(data)
    .returning("shipping_order_id");
  return row.shipping_order_id;
}

export async function findShippingOrderByOrderId(order_id: number) {
  return db("shipping_order").where({ order_id }).first();
}

export async function findShippingOrderByTrackingCode(tracking_code: string) {
  return db("shipping_order").where({ tracking_code }).first();
}

// ─── Shipping Logs ────────────────────────────────────────────────────────────

export async function insertShippingLog(
  shipping_order_id: number,
  ghnStatus: string,
) {
  const status = mapGhnStatus(ghnStatus); // enforce ≤10 chars
  return db("shipping_logs").insert({
    shipping_order_id,
    status,
    updated_date: db.fn.now(),
  });
}

export async function getLatestShippingLog(shipping_order_id: number) {
  return db("shipping_logs")
    .where({ shipping_order_id })
    .orderBy("updated_date", "desc")
    .first();
}

export async function getShippingLogsByOrderId(order_id: number) {
  return db("shipping_logs as sl")
    .join(
      "shipping_order as so",
      "sl.shipping_order_id",
      "so.shipping_order_id",
    )
    .where("so.order_id", order_id)
    .select("sl.*")
    .orderBy("sl.updated_date", "desc");
}

// ─── Location Cache Queries ───────────────────────────────────────────────────

export async function findAllProvinces() {
  return db("province")
    .select(
      "province_id",
      "province_name",
      "province_code",
      "canupdatecod",
      "status",
    )
    .orderBy("province_name");
}

export async function findDistrictsByProvince(province_id: number) {
  return db("district")
    .select(
      "district_id",
      "district_name",
      "district_code",
      "canupdatecod",
      "status",
      "supporttype",
    )
    .where({ province_id })
    .orderBy("district_name");
}

export async function findWardsByDistrict(district_id: number) {
  return db("ward")
    .select(
      "ward_id",
      "ward_name",
      "district_id",
      "canupdatecod",
      "status",
      "supporttype",
    )
    .where({ district_id })
    .orderBy("ward_name");
}
