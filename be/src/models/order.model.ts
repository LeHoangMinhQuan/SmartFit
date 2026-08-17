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
 * STAFF-ROLE FEATURE: resolves the display name of whoever is currently
 * handling an order (order.staff_id), for the staff order-detail page.
 * Kept separate from findOrderById (used in many non-admin contexts —
 * webhooks, VNPay flows — where this join would be wasted work) rather
 * than folded into it.
 */
export async function findOrderHandlerName(
  staff_id: number,
): Promise<string | null> {
  const row = await db("staff").where({ staff_id }).select("name").first();
  return row?.name ?? null;
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

// BUG FIX: previously plain `db("ORDER").where(...)`, with no join to
// payment_method — every order returned from here (i.e. everything the
// customer-facing GET /orders/:order_id and VNPay flows see) came back
// with payment_method_name undefined. order-detail page.tsx's
// handleCancel() reads order.payment_method_name.toLowerCase() to decide
// COD vs. prepaid; calling toLowerCase() on undefined threw synchronously
// out of the onClick handler, so "Cancel Order" silently did nothing on
// any order (most visibly once an order reached "paid", since COD orders
// are cancellable earlier too but got less testing there). Joining
// payment_method here — same join findOrderWithCustomerInfo already does,
// just scoped to (order_id, user_id) instead of order_id alone — fixes it
// at the source instead of patching every caller.
export async function findOrderByIdAndUser(order_id: number, user_id: number) {
  return db("ORDER as o")
    .join("payment_method as pm", "o.payment_method_id", "pm.payment_method_id")
    .where({ "o.order_id": order_id, "o.user_id": user_id })
    .select("o.*", "pm.name as payment_method_name")
    .first();
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

// STAFF-ROLE FEATURE: order.staff_id is the fulfillment owner (who
// picks/packs/hands off to the shipper), not who placed the order. Every
// order starts on staff_id = 1 (SYSTEM_STAFF_ID, see order.service.ts) as
// a placeholder — it means "unclaimed", not "assigned to staff #1". This
// constant is duplicated here (rather than imported from order.service.ts)
// to avoid a circular import between the model and service layers; if it
// ever changes, keep both in sync.
const SYSTEM_STAFF_ID = 1;

// Orders that were confirmed (COD or VNPay) but never got a GHN shipment —
// createShipmentForOrder() failed (or was never attempted) after the order
// was already committed as paid/cod_confirmed, so the customer's money (or
// COD promise) is locked in but there's no tracking_code and the order
// won't naturally progress through fulfillment. See order.service.ts's
// applyPaymentResult / createOrder comments for why this is a
// "gate, don't roll back" situation rather than something that fails the
// order outright. Staff need a way to find these without paging through
// every order manually — that's what needs_fulfillment filters for.
const STUCK_SHIPMENT_STATUSES = ["paid", "cod_confirmed"];

export async function findAllOrders(filters: {
  status?: string;
  user_id?: number;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  needs_fulfillment?: boolean;
  // Orders still sitting on the SYSTEM_STAFF_ID placeholder — i.e. no
  // staff member has claimed them yet (see adminUpdateStatus's ownership
  // comment in order.service.ts). Backs the dashboard's "Unclaimed
  // Orders" needs-attention card so staff can click straight through to
  // the actual list instead of just seeing a bare count.
  unclaimed?: boolean;
}) {
  const {
    status,
    user_id,
    from,
    to,
    page = 1,
    limit = 20,
    needs_fulfillment,
    unclaimed,
  } = filters;
  const offset = (page - 1) * limit;

  // LEFT JOIN (not inner) — a deleted/orphaned user_id shouldn't make an
  // otherwise-valid order vanish from the admin list, it should just show
  // no username. "ORDER".* keeps every existing consumer's field shape
  // intact; username is additive.
  //
  // Second LEFT JOIN pulls the handling staff's name for display — LEFT
  // (not inner) so a row is never dropped if a staff account is ever
  // deleted, and because the placeholder SYSTEM_STAFF_ID row may not be a
  // "real" staff account worth resolving a name for anyway.
  let query = db("ORDER")
    .leftJoin("USER", "USER.user_id", "ORDER.user_id")
    .leftJoin("staff", "staff.staff_id", "ORDER.staff_id")
    .select("ORDER.*", "USER.username", "staff.name as handler_name");
  if (status) query = query.where({ "ORDER.status": status });
  if (user_id) query = query.where({ "ORDER.user_id": user_id });
  if (from) query = query.where("ORDER.created_at", ">=", from);
  if (to) query = query.where("ORDER.created_at", "<=", to);
  if (needs_fulfillment) {
    query = query
      .whereIn("ORDER.status", STUCK_SHIPMENT_STATUSES)
      .whereNull("ORDER.shipping_order_id");
  }
  if (unclaimed) {
    query = query.where("ORDER.staff_id", SYSTEM_STAFF_ID);
  }

  const rows = await query
    .orderBy("ORDER.created_at", "desc")
    .limit(limit)
    .offset(offset);

  // is_unclaimed lets the frontend show "Unassigned" instead of a
  // misleading "System" handler name, without needing to know the magic
  // placeholder ID itself.
  const rowsWithClaim = rows.map((r: any) => ({
    ...r,
    is_unclaimed: r.staff_id === SYSTEM_STAFF_ID,
  }));

  let countQ = db("ORDER").count("order_id as total");
  if (status) countQ = countQ.where({ status });
  if (user_id) countQ = countQ.where({ user_id });
  if (from) countQ = countQ.where("created_at", ">=", from);
  if (to) countQ = countQ.where("created_at", "<=", to);
  if (needs_fulfillment) {
    countQ = countQ
      .whereIn("status", STUCK_SHIPMENT_STATUSES)
      .whereNull("shipping_order_id");
  }
  if (unclaimed) {
    countQ = countQ.where("staff_id", SYSTEM_STAFF_ID);
  }
  const totalResult = await countQ;
  const total = totalResult[0]?.["total"] ?? 0;

  return { rows: rowsWithClaim, total: Number(total) };
}

// Statuses an order can be unclaimed in without meaning anything went
// wrong: it either never got past the payment gate (pending_payment) or
// died before ever needing fulfillment (payment_failed, cancelled). Every
// other status implies the order was confirmed at some point and should
// have a staff owner.
const NOT_YET_CONFIRMED_STATUSES = [
  "pending_payment",
  "payment_failed",
  "cancelled",
];

/**
 * Order ids still sitting on SYSTEM_STAFF_ID (unclaimed) that have moved
 * past the payment gate — i.e. actually need a staff owner, not just
 * abandoned at checkout. Safety-net sweep target for
 * order.service.ts's autoAssignUnclaimedOrders(): the immediate
 * auto-assign call (right where notifyStaffOfConfirmedOrder already
 * fires) should catch these the moment they're confirmed, so this only
 * exists to pick up whatever slips through that path — e.g. a server
 * restart between shipment creation and the assign call.
 */
export async function findUnclaimedActionableOrderIds(): Promise<number[]> {
  const rows = await db("ORDER")
    .select("order_id")
    .where("staff_id", SYSTEM_STAFF_ID)
    .whereNotIn("status", NOT_YET_CONFIRMED_STATUSES);
  return rows.map((r: { order_id: number }) => r.order_id);
}

export async function updateOrderStatus(order_id: number, status: OrderStatus) {
  return db("ORDER")
    .where({ order_id })
    .update({ status, updated_at: db.fn.now() });
}

/**
 * STAFF-ROLE FEATURE: assigns real fulfillment ownership on an order that
 * was still sitting on the SYSTEM_STAFF_ID placeholder set at checkout
 * (see order.service.ts's createOrder — customer-facing requests have no
 * staff in context, so that placeholder just satisfies ORDER.staff_id's
 * NOT NULL constraint until someone actually starts working the order).
 * Called once, by adminUpdateStatus, the first time any staff/admin
 * advances an order past that placeholder.
 */
export async function claimOrder(order_id: number, staff_id: number) {
  return db("ORDER")
    .where({ order_id })
    .update({ staff_id, updated_at: db.fn.now() });
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
