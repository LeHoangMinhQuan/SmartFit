import db from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import * as OrderModel from "../models/order.model.js";
import * as CartModel from "../models/cart.model.js";
import * as VoucherModel from "../models/voucher.model.js";
import * as ShippingModel from "../models/shipping.model.js";

const SYSTEM_STAFF_ID = 1;
const DEFAULT_STORE_ID = 1; // TODO: resolve closest store by ward; using store 1 for now

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ["paid", "payment_failed", "cancelled"],
  paid: ["preparing", "refund_requested", "cancelled"],
  preparing: ["shipping", "cancelled"],
  shipping: ["delivered"],
  delivered: ["refund_requested"],
  payment_failed: [],
  cancelled: [],
  refund_requested: ["refunded"],
  refunded: [],
};

export async function createOrder(
  user_id: number,
  data: {
    payment_method_id: number;
    shipping_address: string;
    ward_id: number;
    voucher_code?: string;
  },
) {
  // 1. Load cart items
  const cartItems = await CartModel.getCartItems(user_id);
  if (!cartItems.length) throw new ApiError(400, "Cart is empty");

  // 2. Validate voucher if provided
  let voucher: any = null;
  let discountAmount = 0;
  const rawTotal = cartItems.reduce(
    (sum: number, i: any) => sum + Number(i.subtotal),
    0,
  );

  if (data.voucher_code) {
    voucher = await VoucherModel.validateVoucher(data.voucher_code, rawTotal);
    if (!voucher)
      throw new ApiError(
        400,
        "Voucher is invalid, expired, or minimum order amount not met",
      );
    discountAmount = VoucherModel.computeVoucherDiscount(voucher, rawTotal);
  }

  const total_amount = Math.max(0, rawTotal - discountAmount);

  // 3. Build order items list
  const orderItems = cartItems.map((item: any) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    quantity: item.quantity,
    unit_price: Number(item.unit_price),
    subtotal: Number(item.subtotal),
  }));

  // 4. All writes in a single transaction
  return db.transaction(async (trx) => {
    // Decrement stock per item
    for (const item of orderItems) {
      const stock = await trx("store_product")
        .where({
          product_id: item.product_id,
          variant_id: item.variant_id,
          store_id: DEFAULT_STORE_ID,
        })
        .first();

      if (!stock || stock.quantity < item.quantity) {
        throw new ApiError(
          409,
          `Insufficient stock for product ${item.product_id} variant ${item.variant_id}`,
        );
      }

      await trx("store_product")
        .where({
          product_id: item.product_id,
          variant_id: item.variant_id,
          store_id: DEFAULT_STORE_ID,
        })
        .decrement("quantity", item.quantity);
    }

    // Create order (shipping_order_id nullable — filled after payment via IPN)
    const [orderRow] = await trx('"ORDER"')
      .insert({
        user_id,
        staff_id: SYSTEM_STAFF_ID,
        payment_method_id: data.payment_method_id,
        shipping_address: data.shipping_address,
        total_amount,
        status: "pending_payment",
      })
      .returning("order_id");
    const order_id = orderRow.order_id;

    // Insert order items
    await trx("order_item").insert(
      orderItems.map((i: any) => ({ ...i, order_id })),
    );

    // Apply voucher
    if (voucher) {
      await trx("voucher_usage").insert({
        voucher_id: voucher.voucher_id,
        order_id,
        user_id,
      });
      await trx("voucher")
        .where({ voucher_id: voucher.voucher_id })
        .increment("usage_count", 1);
    }

    // Clear cart
    await trx("cart_item").where({ user_id, cart_id: 1 }).delete();

    return { order_id, total_amount };
  });
}

export async function getUserOrders(
  user_id: number,
  page?: number,
  limit?: number,
) {
  return OrderModel.findOrdersByUser(user_id, page, limit);
}

export async function getOrderDetail(order_id: number, user_id: number) {
  const order = await OrderModel.findOrderByIdAndUser(order_id, user_id);
  if (!order) throw new ApiError(404, "Order not found");

  const [items, shipping] = await Promise.all([
    OrderModel.findOrderItems(order_id),
    ShippingModel.findShippingOrderByOrderId(order_id),
  ]);

  let shippingLogs: any[] = [];
  if (shipping) {
    shippingLogs = await ShippingModel.getShippingLogsByOrderId(order_id);
  }

  return { ...order, items, shipping, shippingLogs };
}

export async function cancelOrder(order_id: number, user_id: number) {
  const order = await OrderModel.findOrderByIdAndUser(order_id, user_id);
  if (!order) throw new ApiError(404, "Order not found");

  const cancellable = ["paid", "preparing"];
  if (!cancellable.includes(order.status)) {
    throw new ApiError(
      400,
      `Cannot cancel an order with status '${order.status}'`,
    );
  }

  return db.transaction(async (trx) => {
    // Restore stock
    const items = await trx("order_item").where({ order_id });
    for (const item of items) {
      await trx("store_product")
        .where({
          product_id: item.product_id,
          variant_id: item.variant_id,
          store_id: DEFAULT_STORE_ID,
        })
        .increment("quantity", item.quantity);
    }

    await trx('"ORDER"')
      .where({ order_id })
      .update({ status: "cancelled", updated_at: db.fn.now() });
  });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminListOrders(
  filters: Parameters<typeof OrderModel.findAllOrders>[0],
) {
  return OrderModel.findAllOrders(filters);
}

export async function adminUpdateStatus(order_id: number, newStatus: string) {
  const order = await OrderModel.findOrderById(order_id);
  if (!order) throw new ApiError(404, "Order not found");

  const allowed = VALID_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(
      400,
      `Cannot transition from '${order.status}' to '${newStatus}'`,
    );
  }

  await OrderModel.updateOrderStatus(order_id, newStatus as any);
}

export async function adminGetOrderDetail(order_id: number) {
  const order = await OrderModel.findOrderById(order_id);
  if (!order) throw new ApiError(404, "Order not found");
  const items = await OrderModel.findOrderItems(order_id);
  const shipping = await ShippingModel.findShippingOrderByOrderId(order_id);
  return { ...order, items, shipping };
}
