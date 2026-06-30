import db from "../config/db.js";

export type OrderStatus =
  | "pending_payment"
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
  shipping_address: string; // VARCHAR(70) denormalized
  total_amount: number;
  status: OrderStatus;
}

// ─── Order ────────────────────────────────────────────────────────────────────

export async function createOrder(data: CreateOrderData): Promise<number> {
  const [row] = await db('"ORDER"').insert(data).returning("order_id");
  return row.order_id;
}

export async function findOrderById(order_id: number) {
  return db('"ORDER"').where({ order_id }).first();
}

export async function findOrderByIdAndUser(order_id: number, user_id: number) {
  return db('"ORDER"').where({ order_id, user_id }).first();
}

export async function findOrdersByUser(user_id: number, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const rows = await db('"ORDER"')
    .where({ user_id })
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset);
  const [{ total }] = await db('"ORDER"')
    .where({ user_id })
    .count("order_id as total");
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

  let query = db('"ORDER"').select("*");
  if (status) query = query.where({ status });
  if (user_id) query = query.where({ user_id });
  if (from) query = query.where("created_at", ">=", from);
  if (to) query = query.where("created_at", "<=", to);

  const rows = await query
    .orderBy("created_at", "desc")
    .limit(limit)
    .offset(offset);

  let countQ = db('"ORDER"').count("order_id as total");
  if (status) countQ = countQ.where({ status });
  if (user_id) countQ = countQ.where({ user_id });
  const [{ total }] = await countQ;

  return { rows, total: Number(total) };
}

export async function updateOrderStatus(order_id: number, status: OrderStatus) {
  return db('"ORDER"')
    .where({ order_id })
    .update({ status, updated_at: db.fn.now() });
}

export async function setOrderShippingId(
  order_id: number,
  shipping_order_id: number,
) {
  return db('"ORDER"')
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
    )
    .distinct("oi.product_id", "oi.variant_id");
}
