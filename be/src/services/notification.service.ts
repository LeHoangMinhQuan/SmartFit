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
        <p><strong>Tracking code:</strong> ${shipping?.tracking_code ?? "(not available — check GHN manually)"}</p>
        <p><strong>Shipping address:</strong> ${order.shipping_address}</p>
        <p><strong>Items:</strong></p>
        <ul>${itemsHtml}</ul>
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
