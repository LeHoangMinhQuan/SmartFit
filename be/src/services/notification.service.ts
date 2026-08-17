/**
 * services/notification.service.ts
 *
 * NOTE (2026-08-01): added after reverting GHN webhook auto-tracking
 * (too much for a demo-scale setup — raising a support ticket with GHN
 * just to get webhook delivery configured isn't worth it here). Delivery
 * status is now staff-driven end to end: this email is what tells staff
 * an order exists and needs attention in the first place, since nothing
 * else pushes that information to them — see BUG_TRACKER.md's note on
 * how the manual preparing → shipping → delivered flow works.
 *
 * Called once an order is confirmed AND its GHN shipment has been
 * created (order.service.ts's COD path, vnpay.service.ts's IPN success
 * path) — the tracking code is what makes the email actually actionable,
 * so it fires after createShipmentForOrder succeeds, not at raw order
 * creation.
 */
import { env } from "../config/env.js";
import { sendMail } from "../config/mailer.js";
import * as OrderModel from "../models/order.model.js";
import * as ShippingModel from "../models/shipping.model.js";

export async function notifyStaffOfConfirmedOrder(
  order_id: number,
): Promise<void> {
  const to = env.ORDER_NOTIFICATION_EMAIL;
  if (!to) {
    console.warn(
      `[notification] ORDER_NOTIFICATION_EMAIL not configured — skipping new-order email for order ${order_id}`,
    );
    return;
  }

  try {
    const [order, items, shipping] = await Promise.all([
      OrderModel.findOrderById(order_id),
      OrderModel.findOrderItems(order_id),
      ShippingModel.findShippingOrderByOrderId(order_id),
    ]);
    if (!order) return;

    const itemsHtml = items
      .map(
        (i: any) =>
          `<li>${i.quantity} × ${i.product_name}${
            i.variant_name ? ` (${i.variant_name})` : ""
          }</li>`,
      )
      .join("");

    // Same formatting the frontend uses (lib/utils.ts's formatPrice) so
    // the amount in this email matches what staff see on the order
    // detail page — Intl.NumberFormat works identically server-side.
    const formattedTotal = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Number(order.total_amount));
    const orderDetailUrl = `${env.FRONTEND_URL}/staff/orders/${order_id}`;

    await sendMail({
      to,
      subject: `New order #${order_id} ready for fulfillment`,
      html: `
        <p>Order #${order_id} is confirmed${
          order.status === "cod_confirmed"
            ? " (COD)"
            : order.status === "paid"
              ? " (paid via VNPay)"
              : ""
        } and a GHN shipment has been created.</p>
        <p><strong>Total:</strong> ${formattedTotal}</p>
        <p><strong>Tracking code:</strong> ${shipping?.tracking_code ?? "(not available — check GHN manually)"}</p>
        <p><strong>Shipping address:</strong> ${order.shipping_address}</p>
        <p><strong>Items:</strong></p>
        <ul>${itemsHtml}</ul>
        <p><a href="${orderDetailUrl}">View order #${order_id} →</a></p>
        <p>
          GHN webhook auto-tracking is not enabled for this store, so delivery
          status won't update on its own — please check the tracking code
          periodically (GHN's portal, or <code>GET /api/shipping/track/${shipping?.tracking_code ?? "&lt;tracking_code&gt;"}</code>)
          and move the order through preparing → shipping → delivered on the
          staff order detail page as it progresses.
        </p>
      `,
    });

    console.log(
      `[notification] Sent new-order email for order ${order_id} to ${to}`,
    );
  } catch (err) {
    // Fails safe — matches createShipmentForOrder's own pattern right
    // above this call in every caller. A failed notification must never
    // roll back or retry-block order confirmation itself; worst case,
    // staff just don't get pinged and find the order in the dashboard
    // list instead.
    console.error(
      `[notification] Failed to send new-order email for order ${order_id}:`,
      err,
    );
  }
}

/**
 * Called from order.service.ts's cancelOrder() the moment a prepaid order
 * moves to 'refund_requested' — see that function's comment: cancelling a
 * prepaid order never auto-refunds (a wrong refund is a real financial
 * mistake), it just flags the order for a staff member to review and
 * trigger vnpay.service.ts's processRefund from the dashboard. Without
 * this email nothing tells staff that review is needed; the order would
 * just sit there until someone happened to filter the orders list by
 * status, exactly the same "nothing else pushes this information to
 * them" gap notifyStaffOfConfirmedOrder exists for.
 */
export async function notifyStaffOfRefundRequest(
  order_id: number,
): Promise<void> {
  const to = env.ORDER_NOTIFICATION_EMAIL;
  if (!to) {
    console.warn(
      `[notification] ORDER_NOTIFICATION_EMAIL not configured — skipping refund-request email for order ${order_id}`,
    );
    return;
  }

  try {
    const order = await OrderModel.findOrderById(order_id);
    if (!order) return;

    await sendMail({
      to,
      subject: `Refund requested for order #${order_id}`,
      html: `
        <p>Order #${order_id} was cancelled by the customer after payment
        and is now awaiting refund review.</p>
        <p><strong>Amount:</strong> ${order.total_amount}</p>
        <p><strong>Shipping address:</strong> ${order.shipping_address}</p>
        <p>
          This order will stay in "refund_requested" until a staff member
          reviews it and processes the refund from the order detail page —
          nothing happens automatically.
        </p>
      `,
    });

    console.log(
      `[notification] Sent refund-request email for order ${order_id} to ${to}`,
    );
  } catch (err) {
    // Same fail-safe rule as the other notify* functions in this file —
    // must never undo or retry-block the cancellation that already
    // committed.
    console.error(
      `[notification] Failed to send refund-request email for order ${order_id}:`,
      err,
    );
  }
}

/**
 * Called from vnpay.service.ts's processRefund once VNPay has responded —
 * both on success and on failure, since a failed refund needs at least as
 * much attention as a successful one (the order is left back in
 * 'refund_requested' for staff to retry — see that function's comment).
 * Confirms to whoever is watching the inbox that the Process Refund click
 * actually did something, rather than leaving them to reload the order
 * detail page to find out.
 */
export async function notifyStaffOfRefundOutcome(
  order_id: number,
  outcome: { status: "success" | "failed"; message: string },
): Promise<void> {
  const to = env.ORDER_NOTIFICATION_EMAIL;
  if (!to) {
    console.warn(
      `[notification] ORDER_NOTIFICATION_EMAIL not configured — skipping refund-outcome email for order ${order_id}`,
    );
    return;
  }

  try {
    const succeeded = outcome.status === "success";
    await sendMail({
      to,
      subject: succeeded
        ? `Refund confirmed for order #${order_id}`
        : `⚠ Refund FAILED for order #${order_id}`,
      html: `
        <p>Order #${order_id}'s refund ${succeeded ? "was confirmed by VNPay" : "failed"}.</p>
        <p><strong>VNPay message:</strong> ${outcome.message}</p>
        ${
          succeeded
            ? ""
            : `<p>The order remains in "refund_requested" — retry Process
               Refund from the order detail page once the underlying issue
               is resolved.</p>`
        }
      `,
    });

    console.log(
      `[notification] Sent refund-outcome (${outcome.status}) email for order ${order_id} to ${to}`,
    );
  } catch (err) {
    console.error(
      `[notification] Failed to send refund-outcome email for order ${order_id}:`,
      err,
    );
  }
}

export async function notifyStaffOfShipmentFailure(
  order_id: number,
  error: unknown,
): Promise<void> {
  const to = env.ORDER_NOTIFICATION_EMAIL;
  if (!to) {
    console.warn(
      `[notification] ORDER_NOTIFICATION_EMAIL not configured — skipping shipment-failure email for order ${order_id}`,
    );
    return;
  }

  try {
    const reason = error instanceof Error ? error.message : String(error);

    await sendMail({
      to,
      subject: `⚠ GHN shipment creation FAILED for order #${order_id}`,
      html: `
        <p>Order #${order_id} was confirmed, but creating its GHN shipment
        failed — no tracking code was generated and this order will not
        show up as needing fulfillment.</p>
        <p><strong>Error:</strong> ${reason}</p>
        <p>
          Please check the order (address, ward/district, and delivery
          phone number are the most common causes GHN rejects a shipment)
          and retry shipment creation manually.
        </p>
      `,
    });

    console.log(
      `[notification] Sent shipment-failure email for order ${order_id} to ${to}`,
    );
  } catch (err) {
    // Same fail-safe rule as notifyStaffOfConfirmedOrder — this alert
    // failing must never throw back into the caller's already-caught
    // shipment-creation failure.
    console.error(
      `[notification] Failed to send shipment-failure email for order ${order_id}:`,
      err,
    );
  }
}
