import db from "../config/db.js";

export type OrderStatus =
  | "pending_payment"
  | "cod_confirmed"
  | "paid"
  | "preparing"
  | "shipping"
  | "delivered"
  | "cancelled"
  | "payment_failed"
  | "refund_requested"
  | "refunded";

export interface CreateOrderData {
  user_id: number;
  staff_id: number; // always 1 (system account) for customer orders
  payment_method_id: number;
  shipping_address: string; // VARCHAR(255) denormalized — full concatenated address (address_line, ward, district, province)
  recipient_phone: string; // denormalized delivery contact — see column comment on ORDER
  total_amount: number;
  status: OrderStatus;
}

// ─── Order ────────────────────────────────────────────────────────────────────

export async function createOrder(data: CreateOrderData): Promise<number> {
  const [row] = await db("ORDER").insert(data).returning("order_id");
  return row.order_id;
}

export async function findOrderById(order_id: number) {
  return db("ORDER").where({ order_id }).first();
}

/**
 * Same order row, plus the payment method's name and the customer's
 * display name (from USER) — needed anywhere that has to tell COD from
 * prepaid apart (payment_method.name) or actually reach the customer
 * (createShipmentForOrder). Kept separate from findOrderById rather than
 * changing that function's return shape, since it's used in many places
 * that only expect the bare ORDER columns.
 *
 * The recipient's phone number is NOT joined from USER — it's already on
 * `o.*` as `recipient_phone`, captured at checkout. USER.phone is nullable
 * (Google-authenticated accounts have none) and isn't necessarily who
 * should receive this particular delivery, so it was dropped as a source
 * entirely rather than used as a fallback.
 */
export async function findOrderWithCustomerInfo(order_id: number) {
  return (
    db("ORDER as o")
      .join(
        "payment_method as pm",
        "o.payment_method_id",
        "pm.payment_method_id",
      )
      .join("USER as u", "o.user_id", "u.user_id")
      // ORDER only stores ward_id — district_id lives on the ward row.
      // Previously nothing joined this at all (order.district_id was always
      // undefined wherever it was read), so every GHN shipment ever created
      // sent to_district_id: 0 — an invalid district, not "unknown"/"skip".
      .leftJoin("ward as w", "o.ward_id", "w.ward_id")
      .where("o.order_id", order_id)
      .select(
        "o.*",
        "pm.name as payment_method_name",
        "u.username as customer_name",
        "w.district_id",
      )
      .first()
  );
}

export async function findOrderByIdAndUser(order_id: number, user_id: number) {
  return db("ORDER").where({ order_id, user_id }).first();
}

export async function findOrdersByUser(user_id: number, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const rows = await db("ORDER")
    .where({ user_id })
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset);
  const totalResult = await db("ORDER")
    .where({ user_id })
    .count("order_id as total");
  const total = totalResult[0]?.["total"] ?? 0;

  return { rows, total: Number(total) };
}

export async function findAllOrders(filters: {
  status?: string;
  user_id?: number;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  const { status, user_id, from, to, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  let query = db("ORDER").select("*");
  if (status) query = query.where({ status });
  if (user_id) query = query.where({ user_id });
  if (from) query = query.where("created_at", ">=", from);
  if (to) query = query.where("created_at", "<=", to);

  const rows = await query
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset);

  let countQ = db("ORDER").count("order_id as total");
  if (status) countQ = countQ.where({ status });
  if (user_id) countQ = countQ.where({ user_id });
  const totalResult = await countQ;
  const total = totalResult[0]?.["total"] ?? 0;

  return { rows, total: Number(total) };
}

export async function updateOrderStatus(order_id: number, status: OrderStatus) {
  return db("ORDER")
    .where({ order_id })
    .update({ status, updated_at: db.fn.now() });
}

/**
 * Orders still sitting in 'pending_payment' past the retry window — the
 * customer never finished paying (closed the VNPay tab, session expired,
 * etc.) and no IPN ever arrived to move them to 'paid'/'payment_failed'.
 * Used by expireStalePendingOrders() to sweep these into 'cancelled' and
 * release their held stock, instead of leaving them stuck showing
 * "Pending Payment" forever.
 */
export async function findStalePendingOrders(olderThanMinutes: number) {
  return db("ORDER")
    .where({ status: "pending_payment" })
    .andWhere(
      "created_at",
      "<",
      db.raw(`NOW() - (?::text || ' minutes')::interval`, [olderThanMinutes]),
    );
}

export async function setOrderShippingId(
  order_id: number,
  shipping_order_id: number,
) {
  return db("ORDER")
    .where({ order_id })
    .update({ shipping_order_id, updated_at: db.fn.now() });
}

// ─── Order Item ───────────────────────────────────────────────────────────────

export interface OrderItem {
  order_id: number;
  product_id: number;
  variant_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export async function insertOrderItems(items: OrderItem[]) {
  return db("order_item").insert(items);
}

export async function findOrderItems(order_id: number) {
  return db("order_item as oi")
    .join("product as p", "oi.product_id", "p.product_id")
    .join("product_variant as pv", function () {
      this.on("oi.product_id", "pv.product_id").andOn(
        "oi.variant_id",
        "pv.variant_id",
      );
    })
    .leftJoin("product_image as pi", function () {
      this.on("oi.product_id", "pi.product_id").andOn(
        "oi.variant_id",
        "pi.variant_id",
      );
    })
    .where("oi.order_id", order_id)
    .select(
      "oi.*",
      "p.name as product_name",
      "pv.name as variant_name",
      "pi.s3_url as image_url",
      "p.weight_grams",
      "p.length_cm",
      "p.width_cm",
      "p.height_cm",
    )
    .distinct("oi.product_id", "oi.variant_id");
}
