import db from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import * as OrderModel from "../models/order.model.js";
import * as CartModel from "../models/cart.model.js";
import * as VoucherModel from "../models/voucher.model.js";
import * as ShippingModel from "../models/shipping.model.js";
import * as PaymentModel from "../models/payment_transaction.model.js";
import { DEFAULT_STORE_ID } from "../config/store.js";

const SYSTEM_STAFF_ID = 1;
// Single-store scope (see ecommerce-api-plan.md scope note + §12): GHN has one
// registered shop, so all orders fulfill from the one seeded `store` row.
// Swap this for assignFulfillmentStores() (§12.3) if a second store is added.

// How long an order can sit in 'pending_payment' before we treat it as
// abandoned. VNPay's own payment session defaults to ~15 minutes
// (vnp_ExpireDate) when we don't set one explicitly — this matches that,
// so an order won't outlive the VNPay session it was created for.
const PENDING_PAYMENT_TIMEOUT_MINUTES = 15;

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ["paid", "payment_failed", "cancelled"],
  // COD's own initial state — see the migration's comment for why this
  // isn't just 'pending_payment'. No online payment to wait for, so
  // staff moves it straight into fulfillment once ready; cash is
  // collected by the courier on delivery, not tracked as a separate
  // "paid" step.
  cod_confirmed: ["preparing", "cancelled"],
  paid: ["preparing", "refund_requested", "cancelled"],
  preparing: ["shipping", "cancelled"],
  // Previously only ["delivered"] — a shipment GHN reports as
  // "return" (delivery failed / customer refused / returned to shop)
  // or "cancelled" had nowhere valid to go, so handleGhnStatusUpdate()
  // (ghn.service.ts) couldn't act on those events even though it now
  // receives them. cancelled covers COD (nothing was ever collected,
  // safe to just cancel); refund_requested covers a prepaid order that
  // failed to deliver (money WAS collected, needs a refund, not a
  // silent cancel).
  shipping: ["delivered", "cancelled", "refund_requested"],
  delivered: ["refund_requested"],
  payment_failed: ["cancelled"],
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
    shipping_fee: number;
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

  // Bug fix: this used to be Math.max(0, rawTotal - discountAmount), which
  // is just the cart subtotal minus any voucher discount — shipping_fee
  // was never added, so every order (and every VNPay charge, since
  // vnpay.service.ts reads total_amount directly) silently excluded the
  // delivery fee entirely. shipping_fee is client-supplied (see the schema
  // comment on createOrderSchema for the known trust gap there — not
  // server-recomputed via GHN in this pass).
  const total_amount = Math.max(
    0,
    rawTotal + data.shipping_fee - discountAmount,
  );

  // 3. Build order items list
  const orderItems = cartItems.map((item: any) => ({
    product_id: item.product_id,
    variant_id: item.variant_id,
    store_id: DEFAULT_STORE_ID,
    quantity: item.quantity,
    unit_price: Number(item.unit_price),
    subtotal: Number(item.subtotal),
  }));

  // COD has no online payment step to wait for — 'pending_payment' would
  // leave it silently misclassified as an abandoned VNPay checkout (see
  // sql/migration_cod_and_refunds.sql's comment: expireStalePendingOrders
  // would auto-cancel it after 15 minutes, and every detail-page read
  // would waste a VNPay reconciliation call against a transaction that
  // never existed). Looked up by name rather than trusting a hardcoded
  // ID, matching the same check the checkout page itself already uses
  // (isCOD in app/(customer)/checkout/page.tsx).
  const paymentMethod = await db("payment_method")
    .where({ payment_method_id: data.payment_method_id })
    .first("name");
  if (!paymentMethod) {
    throw new ApiError(400, "Invalid payment method");
  }
  const isCOD = paymentMethod.name.toLowerCase() === "cod";
  const initialStatus = isCOD ? "cod_confirmed" : "pending_payment";

  // 4. All writes in a single transaction
  return db
    .transaction(async (trx) => {
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
      const [orderRow] = await trx("ORDER")
        .insert({
          user_id,
          staff_id: SYSTEM_STAFF_ID,
          payment_method_id: data.payment_method_id,
          shipping_address: data.shipping_address,
          ward_id: data.ward_id,
          total_amount,
          shipping_fee: data.shipping_fee,
          status: initialStatus,
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

      return { order_id, total_amount, isCOD };
    })
    .then(async (result) => {
      // COD: create the GHN shipment right away, same as VNPay does on
      // payment success (see vnpay.service.ts's applyPaymentResult) — COD
      // just has no payment event to wait for first. setImmediate + a
      // failure that only logs (never throws back to the customer) matches
      // that same established pattern: order creation must succeed even if
      // GHN is briefly unreachable — staff can retry shipment creation
      // manually rather than the customer's checkout failing outright.
      if (result.isCOD) {
        setImmediate(async () => {
          try {
            const { createShipmentForOrder } = await import("./ghn.service.js");
            await createShipmentForOrder(result.order_id);
          } catch (err) {
            console.error(
              `[order] COD GHN shipment creation failed for order ${result.order_id}:`,
              err,
            );
          }
        });
      }
      return { order_id: result.order_id, total_amount: result.total_amount };
    });
}

/**
 * Shared by cancelOrder(), cancelOrderBySystem(), and
 * expireStalePendingOrders(): releases the stock that was decremented at
 * order creation and moves the order to `targetStatus` — 'cancelled' when
 * nothing was ever collected (COD, or a VNPay order that never got past
 * pending_payment), 'refund_requested' when money WAS already collected
 * and needs an actual refund rather than a silent cancel. Must run inside
 * the caller's transaction.
 */
async function restoreStockAndCancelOrder(
  trx: typeof db,
  order_id: number,
  targetStatus: "cancelled" | "refund_requested" = "cancelled",
): Promise<void> {
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

  await trx("ORDER")
    .where({ order_id })
    .update({ status: targetStatus, updated_at: db.fn.now() });
}

/**
 * Sweeps orders that have been sitting in 'pending_payment' past
 * PENDING_PAYMENT_TIMEOUT_MINUTES — the customer abandoned checkout (closed
 * the VNPay tab, session timed out, etc.) and no IPN ever arrived to move
 * them to 'paid' or 'payment_failed'. Without this they'd show "Pending
 * Payment" in the app forever while quietly holding stock hostage.
 *
 * Each stale order is: (a) moved to 'cancelled', (b) its held stock
 * restored, (c) any dangling 'pending' payment_transaction row for it
 * marked 'failed' too, so the transaction log doesn't disagree with the
 * order it belongs to.
 *
 * Called lazily wherever orders are read (see getUserOrders/getOrderDetail
 * below) and on a periodic interval (see server.ts) so it doesn't depend on
 * a customer happening to look at their orders to actually run.
 */
export async function expireStalePendingOrders(): Promise<number> {
  const staleOrders = await OrderModel.findStalePendingOrders(
    PENDING_PAYMENT_TIMEOUT_MINUTES,
  );
  if (!staleOrders.length) return 0;

  // NOTE (2026-08-01): reconcilePendingOrder() (vnpay.service.ts) existed
  // since the last session but was never actually called from here — the
  // doc comment on it claimed this wiring already existed; it didn't. That
  // gap is why a payment VNPay itself confirms as successful could still
  // end up auto-cancelled by the block below: nothing ever checked VNPay's
  // own record of the transaction before assuming "timed out" meant
  // "failed". Dynamic import avoids a circular import — vnpay.service.ts
  // already imports expireStalePendingOrders from this file.
  const { reconcilePendingOrder } = await import("./vnpay.service.js");
  const stillStale: typeof staleOrders = [];
  for (const order of staleOrders) {
    await reconcilePendingOrder(order.order_id);
    // Re-check status — reconcilePendingOrder may have just marked this
    // order 'paid'/'payment_failed' itself, in which case it's no longer
    // pending_payment and must NOT be swept into 'cancelled' below.
    const refreshed = await OrderModel.findOrderById(order.order_id);
    if (refreshed?.status === "pending_payment") stillStale.push(order);
  }
  if (!stillStale.length) return 0;

  await db.transaction(async (trx) => {
    for (const order of stillStale) {
      await restoreStockAndCancelOrder(trx, order.order_id);
      await PaymentModel.failPendingTransactionsForOrder(order.order_id, trx);
    }
  });

  return stillStale.length;
}

export async function getUserOrders(
  user_id: number,
  page?: number,
  limit?: number,
) {
  await expireStalePendingOrders();
  return OrderModel.findOrdersByUser(user_id, page, limit);
}

export async function getOrderDetail(order_id: number, user_id: number) {
  await expireStalePendingOrders();
  let order = await OrderModel.findOrderByIdAndUser(order_id, user_id);
  if (!order) throw new ApiError(404, "Order not found");

  // NOTE (2026-08-01): previously, an order only ever got reconciled
  // against VNPay's own record once it turned 15 minutes old (the sweep
  // above) — and even that never actually ran until the fix in
  // expireStalePendingOrders() just above. A customer polling this
  // endpoint right after returning from VNPay (see PageContent.tsx's
  // retry logic) was polling a value nothing was updating in between,
  // for up to 15 minutes. Reconciling the specific order being looked at,
  // regardless of its age, is what makes that polling actually converge
  // quickly instead of only ever resolving via the slow sweep.
  if (order.status === "pending_payment") {
    const { reconcilePendingOrder } = await import("./vnpay.service.js");
    await reconcilePendingOrder(order_id);
    order = (await OrderModel.findOrderByIdAndUser(order_id, user_id)) ?? order;
  }

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
  const order = await OrderModel.findOrderWithCustomerInfo(order_id);
  if (!order || order.user_id !== user_id) {
    throw new ApiError(404, "Order not found");
  }

  const cancellable = ["cod_confirmed", "paid", "preparing"];
  if (!cancellable.includes(order.status)) {
    throw new ApiError(
      400,
      `Cannot cancel an order with status '${order.status}'`,
    );
  }

  const isCOD = order.payment_method_name.toLowerCase() === "cod";
  // COD: nothing was ever collected (cash is only taken on delivery, which
  // hasn't happened) — a plain cancel is correct, same as before.
  //
  // Prepaid via VNPay: money WAS already collected. Cancelling outright
  // would silently keep the customer's payment — this is the concrete bug
  // behind the "missing refund strategy" gap. Move to 'refund_requested'
  // instead (stock restored now; the actual VNPay refund call happens
  // separately once staff reviews and approves it — see
  // vnpay.service.ts's processRefund, triggered from the staff dashboard).
  return db.transaction((trx) =>
    restoreStockAndCancelOrder(
      trx,
      order_id,
      isCOD ? "cancelled" : "refund_requested",
    ),
  );
}

/**
 * System-triggered cancellation (no user_id ownership check) — used when
 * GHN itself reports a delivery as returned/cancelled
 * (handleGhnStatusUpdate, ghn.service.ts), not a customer action. The
 * caller decides whether the resulting status should be 'cancelled' (COD
 * — nothing collected) or 'refund_requested' (prepaid — needs an actual
 * refund).
 */
export async function cancelOrderBySystem(
  order_id: number,
  targetStatus: "cancelled" | "refund_requested",
): Promise<void> {
  await db.transaction((trx) =>
    restoreStockAndCancelOrder(trx, order_id, targetStatus),
  );
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminListOrders(
  filters: Parameters<typeof OrderModel.findAllOrders>[0],
) {
  await expireStalePendingOrders();
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
  await expireStalePendingOrders();
  let order = await OrderModel.findOrderById(order_id);
  if (!order) throw new ApiError(404, "Order not found");

  if (order.status === "pending_payment") {
    const { reconcilePendingOrder } = await import("./vnpay.service.js");
    await reconcilePendingOrder(order_id);
    order = (await OrderModel.findOrderById(order_id)) ?? order;
  }

  const items = await OrderModel.findOrderItems(order_id);
  const shipping = await ShippingModel.findShippingOrderByOrderId(order_id);
  return { ...order, items, shipping };
}
