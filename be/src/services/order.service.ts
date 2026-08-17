import db from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import * as OrderModel from "../models/order.model.js";
import * as CartModel from "../models/cart.model.js";
import * as VoucherModel from "../models/voucher.model.js";
import * as ShippingModel from "../models/shipping.model.js";
import * as PaymentModel from "../models/payment_transaction.model.js";
import { DEFAULT_STORE_ID } from "../config/store.js";
import {
  findStaffRoles,
  findStaffById,
  findDefaultAssignableStaff,
} from "../models/staff.model.js";

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
  // Deliberately NOT ["refunded"]. This table only gates the generic
  // staff dropdown (adminUpdateStatus below) — the real refund flow
  // (vnpay.service.ts's processRefund) calls
  // OrderModel.updateOrderStatus(order_id, "refunded") directly after a
  // verified VNPay refund response, and never consults this table. If
  // "refunded" were listed as a valid manual transition here, staff
  // could pick it straight from the status dropdown and mark an order
  // refunded without VNPay ever actually returning the customer's money
  // — a real financial bug, not just a UX one. refund_requested orders
  // can only become "refunded" through the dedicated Process Refund
  // action.
  refund_requested: [],
  refunded: [],
};

export async function createOrder(
  user_id: number,
  data: {
    payment_method_id: number;
    shipping_address: string;
    ward_id: number;
    recipient_phone: string;
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

  // BUG FIX: shipping_fee used to be taken directly from the client with
  // no server-side verification at all — since it flows straight into
  // total_amount (and VNPay reads total_amount directly, see the comment
  // below), a customer could submit any shipping_fee they liked,
  // including 0, and simply not pay for delivery. Recomputed here via
  // the same GHN autoSelectService() the checkout page's ShippingSelector
  // already calls to SHOW the customer a fee in the first place — this
  // is the authoritative source of truth, not a second opinion, so the
  // client-supplied data.shipping_fee is no longer used for the actual
  // charge. Dynamic import to avoid a circular import (ghn.service.ts
  // already imports OrderModel from this module's sibling files, and
  // this file's own COD path below already imports ghn.service.ts the
  // same way for the same reason).
  const ward = await db("ward")
    .where({ ward_id: data.ward_id })
    .first("district_id");
  if (!ward) throw new ApiError(400, "Invalid ward_id");

  let shipping_fee: number;
  try {
    const { autoSelectService } = await import("./ghn.service.js");
    const quote = await autoSelectService(
      user_id,
      ward.district_id,
      String(data.ward_id),
    );
    shipping_fee = quote.fee;
  } catch (err) {
    // Can't safely charge for shipping without a verified fee — this is
    // the one place in checkout where failing safe means rejecting the
    // order, not falling back to trusting client input, since that
    // input is exactly what this fix exists to stop trusting. Unlike the
    // COD shipment-creation failure below (which happens AFTER money/
    // stock are already committed and would cost the customer a full
    // re-checkout to roll back), this runs before anything is written.
    console.error(
      `[order] shipping fee verification failed for user ${user_id}:`,
      err,
    );
    throw new ApiError(
      502,
      "Couldn't verify the shipping cost for this address — please try again.",
    );
  }

  // Bug fix: this used to be Math.max(0, rawTotal - discountAmount), which
  // is just the cart subtotal minus any voucher discount — shipping_fee
  // was never added, so every order (and every VNPay charge, since
  // vnpay.service.ts reads total_amount directly) silently excluded the
  // delivery fee entirely. shipping_fee is now the server-verified value
  // computed just above, not client input (see the fix above).
  const total_amount = Math.max(0, rawTotal + shipping_fee - discountAmount);

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
          recipient_phone: data.recipient_phone,
          total_amount,
          shipping_fee,
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
      // COD: create the GHN shipment synchronously, as part of this same
      // request — the whole reason to gate on it. This used to be
      // setImmediate (fire-and-forget): the HTTP response went out before
      // this even started, so checkout always reported success regardless
      // of whether GHN accepted the shipment, and the only trace of a
      // failure was a server log line + a staff notification — nothing
      // the customer could ever see.
      //
      // Deliberately NOT rolling back the order on failure, though —
      // this is "gate" as in "tell the truth about what happened", not
      // "deny the order". COD has zero payment at risk (nothing was
      // charged), and by this point stock is already held and the
      // voucher (if any) already consumed — throwing away a legitimate
      // order over a transient GHN outage would cost the customer a full
      // re-checkout for a problem that's usually on GHN's end, not
      // theirs. Staff get notified either way and can retry shipment
      // creation once GHN's back, or reach out to the customer directly.
      //
      // If you'd rather have GHN failures hard-block the order entirely
      // (rolling back stock/voucher usage, no order created), that's a
      // different shape of fix — the GHN call would need to move inside
      // the transaction above, before commit, so a thrown error here
      // rolls the whole insert back. Flagging that as the alternative
      // rather than silently picking one, same as the reasoning that led
      // to 'refund_requested' needing staff review instead of an
      // automatic refund elsewhere in this file.
      let shipping_setup_failed = false;
      if (result.isCOD) {
        try {
          const { createShipmentForOrder } = await import("./ghn.service.js");
          await createShipmentForOrder(result.order_id);
          await autoAssignStaff(result.order_id);
          const { notifyStaffOfConfirmedOrder } =
            await import("./notification.service.js");
          await notifyStaffOfConfirmedOrder(result.order_id);
        } catch (err) {
          shipping_setup_failed = true;
          console.error(
            `[order] COD GHN shipment creation failed for order ${result.order_id}:`,
            err,
          );
          const { notifyStaffOfShipmentFailure } =
            await import("./notification.service.js");
          await notifyStaffOfShipmentFailure(result.order_id, err).catch(
            () => {},
          );
        }
      }
      return {
        order_id: result.order_id,
        total_amount: result.total_amount,
        shipping_setup_failed,
      };
    });
}

/**
 * Shared by cancelOrder() and expireStalePendingOrders(): releases the
 * stock that was decremented at order creation and moves the order to
 * `targetStatus` — 'cancelled' when nothing was ever collected (COD, or
 * a VNPay order that never got past pending_payment), 'refund_requested'
 * when money WAS already collected and needs an actual refund rather
 * than a silent cancel. Must run inside the caller's transaction.
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
  return db.transaction(async (trx) => {
    await restoreStockAndCancelOrder(
      trx,
      order_id,
      isCOD ? "cancelled" : "refund_requested",
    );

    if (!isCOD) {
      // Staff have no other way to learn a refund needs reviewing — same
      // "nothing else pushes this information to them" gap notification
      // .service.ts's file-level comment describes for new orders. Fired
      // fire-and-forget, after the DB transaction succeeds but still
      // inside cancelOrder rather than left to the caller, so every path
      // that can create a 'refund_requested' order sends this the same
      // way (mirrors notifyStaffOfConfirmedOrder / ...OfShipmentFailure's
      // own fail-safe pattern — a failed email must never undo or block
      // the cancellation that already committed).
      const { notifyStaffOfRefundRequest } =
        await import("./notification.service.js");
      notifyStaffOfRefundRequest(order_id).catch(() => {});
    }
  });
}

// cancelOrderBySystem() (system/webhook-triggered cancellation) was
// removed along with the GHN webhook handler — see ghn.service.ts's
// removed handleWebhook comment. Delivery status now only moves forward
// via staff manually picking a status from the dropdown
// (adminUpdateStatus below).

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminListOrders(
  filters: Parameters<typeof OrderModel.findAllOrders>[0],
) {
  await expireStalePendingOrders();
  return OrderModel.findAllOrders(filters);
}

// Statuses a confirmed order can be in while still missing its GHN
// shipment — kept in sync with order.model.ts's STUCK_SHIPMENT_STATUSES
// (duplicated rather than imported for the same reason SYSTEM_STAFF_ID is
// duplicated there: avoiding a circular import between model and service).
const RETRYABLE_SHIPMENT_STATUSES = ["paid", "cod_confirmed"];

/**
 * Manual recovery for the "confirmed but GHN shipment creation failed"
 * case (see applyPaymentResult in vnpay.service.ts and the COD path
 * above) — staff-triggered from the order detail page once GHN is back
 * up or whatever caused the failure (bad address, GHN outage, etc.) has
 * been resolved. Refuses to run on an order that already has a shipment
 * (would create a duplicate GHN order and double-charge shipping) or one
 * that was never confirmed in the first place.
 *
 * required_note is staff-chosen at this point (see the order detail
 * page's picker) rather than always falling back to
 * ghn.service.ts's DEFAULT_REQUIRED_NOTE — by the time something needs a
 * manual retry, staff are already looking at the order and can decide
 * what's appropriate for it.
 */
export async function retryShipment(
  order_id: number,
  required_note?: "CHOTHUHANG" | "CHOXEMHANGKHONGTHU" | "KHONGCHOXEMHANG",
) {
  const order = await OrderModel.findOrderById(order_id);
  if (!order) throw new ApiError(404, "Order not found");

  if (order.shipping_order_id) {
    throw new ApiError(
      400,
      "This order already has a shipment — nothing to retry.",
    );
  }
  if (!RETRYABLE_SHIPMENT_STATUSES.includes(order.status)) {
    throw new ApiError(
      400,
      `Order is in status "${order.status}" — shipment retry only applies to confirmed orders (paid/cod_confirmed) that are missing a shipment.`,
    );
  }

  // Let a failure here propagate as-is (GHN's actual error message, e.g.
  // invalid address) rather than swallowing it like the original
  // fire-and-forget paths do — this is a direct staff action, so they
  // should see exactly why it failed and can retry again once fixed.
  const { createShipmentForOrder } = await import("./ghn.service.js");
  const result = required_note
    ? await createShipmentForOrder(order_id, required_note)
    : await createShipmentForOrder(order_id);

  await autoAssignStaff(order_id);
  const { notifyStaffOfConfirmedOrder } =
    await import("./notification.service.js");
  await notifyStaffOfConfirmedOrder(order_id).catch(() => {});

  return result;
}

/**
 * Lets staff/admin change which GHN required_note option an EXISTING
 * shipment was created with (CHOTHUHANG / CHOXEMHANGKHONGTHU /
 * KHONGCHOXEMHANG) — see ghn.service.ts's updateShipmentRequiredNote for
 * why this is possible post-creation (GHN's Update Order API) and its
 * limits (only while the shipment hasn't been picked up yet).
 */
export async function updateShipmentRequiredNote(
  order_id: number,
  required_note: "CHOTHUHANG" | "CHOXEMHANGKHONGTHU" | "KHONGCHOXEMHANG",
) {
  const { updateShipmentRequiredNote: doUpdate } =
    await import("./ghn.service.js");
  return doUpdate(order_id, required_note);
}

// STAFF-ROLE FEATURE: which target statuses require the 'admin' role,
// versus which any staff account (admin or staff) may set. Route-level
// authorize('admin', 'staff') on PATCH /orders/:order_id/status lets both
// roles hit this endpoint at all — this set is the finer-grained split
// requested on top of that, keyed by the TARGET status rather than the
// (from, to) pair, since these three are sensitive regardless of which
// status the order is coming from:
//   - "cancelled"        — a cancellation, per the "cancel/refund is
//                           admin-only" decision.
//   - "refund_requested" — the first step of a refund; same reasoning.
//   - "paid"             — NOT a cancel or refund, but a manual override
//                           marking an order as paid without going
//                           through the real VNPay confirmation flow
//                           (see VALID_TRANSITIONS's own comment on why
//                           "refunded" is deliberately excluded from this
//                           table for the same kind of reason — a manual
//                           status change standing in for a real payment
//                           event is a financial-trust action, not an
//                           operational one). This wasn't explicitly
//                           named in the cancel/refund instruction — flag
//                           this one if you want "paid" opened up to
//                           staff too.
// Any other target (payment_failed, cod_confirmed, preparing, shipping,
// delivered) is left staff-allowed as ordinary fulfillment progress.
const ADMIN_ONLY_TARGET_STATUSES = new Set([
  "paid",
  "cancelled",
  "refund_requested",
]);

export async function adminUpdateStatus(
  order_id: number,
  newStatus: string,
  actingStaffId: number,
) {
  const order = await OrderModel.findOrderById(order_id);
  if (!order) throw new ApiError(404, "Order not found");

  const allowed = VALID_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(
      400,
      `Cannot transition from '${order.status}' to '${newStatus}'`,
    );
  }

  const roles = await findStaffRoles(actingStaffId);
  const isAdmin = roles.some((r: { name: string }) => r.name === "admin");

  if (ADMIN_ONLY_TARGET_STATUSES.has(newStatus) && !isAdmin) {
    throw new ApiError(
      403,
      `Only admin can set order status to '${newStatus}'`,
    );
  }

  // ─── Order ownership (STAFF-ROLE FEATURE) ────────────────────────────────
  // order.staff_id records who is actually handling fulfillment — packing
  // and handing off to the shipper — not who placed the order (that's
  // user_id). createOrder() has no staff in its request context (it's a
  // customer-facing checkout call), so every order is inserted with
  // SYSTEM_STAFF_ID as a placeholder to satisfy the NOT NULL constraint;
  // that value means "unclaimed", not "actually assigned to staff #1".
  //
  // Ownership rule, per design decision:
  //   - First staff/admin to advance an order past that placeholder claims
  //     it — staff_id is set to actingStaffId at that point.
  //   - Once claimed by a specific staff member (not the system
  //     placeholder), only that same staff member OR any admin may make
  //     further status changes. A different staff account is blocked, even
  //     for otherwise-staff-allowed target statuses like "shipping" or
  //     "delivered" — this prevents two staff accounts from both working
  //     the same order and stepping on each other mid-fulfillment.
  //   - Admins are never blocked by another staff's claim (they can always
  //     act), but acting as admin on someone else's claimed order does NOT
  //     transfer ownership — staff_id stays with whoever originally
  //     claimed it, since admin intervention here is oversight/override,
  //     not taking over day-to-day fulfillment.
  const isClaimed = order.staff_id !== SYSTEM_STAFF_ID;
  if (isClaimed && order.staff_id !== actingStaffId && !isAdmin) {
    throw new ApiError(
      403,
      "This order is already being handled by another staff member",
    );
  }

  await OrderModel.updateOrderStatus(order_id, newStatus as any);

  if (!isClaimed) {
    await OrderModel.claimOrder(order_id, actingStaffId);
  }
}

// STAFF-ROLE FEATURE: lets an admin directly hand an unclaimed order to a
// specific staff member, rather than the only previous path — waiting for
// *some* staff/admin to happen to advance its status, which auto-claims it
// for whoever clicked first (see adminUpdateStatus above). The staff order
// list already shows a handler name / "Unassigned" per order, but had no
// way to actually assign one — this is that missing action.
//
// Admin-only (matches the rest of the ownership-sensitive actions in this
// file) and only permitted while the order is still unclaimed: once a real
// staff member has it, reassigning is a bigger decision (taking work away
// from someone) that isn't in scope for this simple combobox — an admin
// can already override via ordinary status changes per the ownership rule
// in adminUpdateStatus.
export async function adminAssignStaff(
  order_id: number,
  targetStaffId: number,
) {
  if (targetStaffId === SYSTEM_STAFF_ID) {
    // Defensive guard — the assign-combobox now excludes this account at
    // the source (GET /admin/staff?assignable=true), but this endpoint
    // shouldn't rely solely on the frontend never sending it. Assigning to
    // the placeholder is a no-op that looks like success (the write
    // happens, is_unclaimed stays true) — reject it explicitly instead.
    throw new ApiError(
      400,
      "Cannot assign an order to the system placeholder account",
    );
  }

  const order = await OrderModel.findOrderById(order_id);
  if (!order) throw new ApiError(404, "Order not found");

  if (order.staff_id !== SYSTEM_STAFF_ID) {
    throw new ApiError(
      400,
      "This order is already assigned — reassign it via a status change instead.",
    );
  }

  const staff = await findStaffById(targetStaffId);
  if (!staff) throw new ApiError(404, "Staff member not found");

  await OrderModel.claimOrder(order_id, targetStaffId);
}

/**
 * Auto-assign counterpart to adminAssignStaff above — same underlying
 * claimOrder() and the same ownership rule it protects (see
 * adminUpdateStatus's comment), just triggered by the system instead of
 * an admin clicking a combobox. Store currently runs with one real staff
 * account (see findDefaultAssignableStaff's comment), so there's no
 * routing decision to make — this exists so orders don't sit unclaimed
 * requiring a manual admin assign at all.
 *
 * Called right alongside notifyStaffOfConfirmedOrder (COD checkout,
 * retryShipment, and vnpay.service.ts's IPN success path) so an order
 * gets a staff owner the moment it's actually confirmed, and again by
 * the sweep below as a safety net. Always a no-op rather than a thrown
 * error on anything unexpected — must never block the payment/shipment
 * flow it's piggybacking on.
 */
export async function autoAssignStaff(order_id: number): Promise<void> {
  try {
    const order = await OrderModel.findOrderById(order_id);
    if (!order || order.staff_id !== SYSTEM_STAFF_ID) return;

    const staff = await findDefaultAssignableStaff();
    if (!staff) {
      console.warn(
        `[order] autoAssignStaff: no assignable staff account found — order ${order_id} stays unclaimed for manual assignment.`,
      );
      return;
    }

    await OrderModel.claimOrder(order_id, staff.staff_id);
    console.log(
      `[order] Auto-assigned order ${order_id} to staff_id=${staff.staff_id}.`,
    );
  } catch (err) {
    // Fail-safe, matching every other notify*/auto* helper called from
    // the confirmation paths — a failure here must never roll back or
    // retry-block the order confirmation itself.
    console.error(`[order] autoAssignStaff failed for order ${order_id}:`, err);
  }
}

/**
 * Safety-net sweep, mirroring expireStalePendingOrders' pattern (see
 * server.ts's runStaleOrderSweep). autoAssignStaff() already runs
 * immediately once an order is confirmed, so in the normal case this
 * finds nothing — it only matters if that immediate call was missed
 * (e.g. a server restart between shipment creation and the assign call).
 */
export async function autoAssignUnclaimedOrders(): Promise<number> {
  const orderIds = await OrderModel.findUnclaimedActionableOrderIds();
  for (const order_id of orderIds) {
    await autoAssignStaff(order_id);
  }
  return orderIds.length;
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

  // STAFF-ROLE FEATURE: who's currently handling fulfillment. is_unclaimed
  // lets the frontend show "Unassigned" without hardcoding the
  // SYSTEM_STAFF_ID placeholder itself.
  const is_unclaimed = order.staff_id === SYSTEM_STAFF_ID;
  const handler_name = is_unclaimed
    ? null
    : await OrderModel.findOrderHandlerName(order.staff_id);

  // Only relevant once a refund has actually been attempted — lets staff
  // see why a previous attempt failed (e.g. VNPay declined) instead of
  // just seeing the order stuck at 'refund_requested' with no context.
  let latest_refund = null;
  if (order.status === "refund_requested" || order.status === "refunded") {
    const { findRefundByOrderId } =
      await import("../models/payment_refund.model.js");
    latest_refund = (await findRefundByOrderId(order_id)) ?? null;
  }

  return {
    ...order,
    items,
    shipping,
    latest_refund,
    handler_name,
    is_unclaimed,
  };
}
