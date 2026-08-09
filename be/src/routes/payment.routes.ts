import { Router, urlencoded } from "express";
import { authenticate } from "../middleware/authenticate.js";
import * as PaymentController from "../controllers/payment.controller.js";
/**
 * ⚠️  IPN MUST be registered BEFORE express.json() in app.ts.
 *
 * FIXED (2026-08-09): VNPay's actual sandbox gateway calls the IPN URL as
 * a GET with all fields in the query string (confirmed via nginx access
 * log: `GET /api/payments/vnpay/ipn?vnp_...` from UA "VNPAY GATEWAY/2.0"),
 * NOT a POST with an application/x-www-form-urlencoded body as previously
 * assumed here. The old `.post()`-only route meant every real IPN call
 * 404'd before ever reaching vnpayIpn() — VNPay saw a 404, never marked
 * the notification delivered, and the order sat in 'pending_payment'
 * forever (rescued only by reconcilePendingOrder()'s queryDr polling,
 * which itself was getting inconclusive "duplicate request" codes because
 * of how often the sweep was retrying). Handling GET here (query string,
 * no body parser needed) is what actually matches VNPay's wire behavior.
 * POST is kept too, in case VNPay's config or a different environment
 * ever sends it that way — both paths funnel into the same handler.
 */
export const paymentIpnRouter = Router();
paymentIpnRouter.get("/vnpay/ipn", PaymentController.vnpayIpn);
paymentIpnRouter.post(
  "/vnpay/ipn",
  urlencoded({ extended: false }),
  PaymentController.vnpayIpn,
);

// Everything else needs express.json() to have already run — mount this
// router AFTER express.json() in app.ts (alongside the other /api/* routes).
const router = Router();
router.get("/methods", PaymentController.getPaymentMethods);
router.post("/vnpay/create", authenticate, PaymentController.createPaymentUrl);
router.get("/vnpay/return", PaymentController.vnpayReturn);

export default router;
