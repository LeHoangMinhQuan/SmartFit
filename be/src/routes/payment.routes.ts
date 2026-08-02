import { Router, urlencoded } from "express";
import { authenticate } from "../middleware/authenticate.js";
import * as PaymentController from "../controllers/payment.controller.js";
/**
 * ⚠️  IPN MUST be registered BEFORE express.json() in app.ts.
 * VNPay sends IPN as application/x-www-form-urlencoded.
 * Using express.urlencoded here as a route-scoped middleware.
 *
 * This router holds ONLY the IPN route and must be mounted in app.ts
 * BEFORE `app.use(express.json())`. Previously the *entire* paymentRoutes
 * router (including /vnpay/create) was mounted before express.json(), so
 * none of its routes ever saw a parsed body — Express only reaches
 * express.json() for requests that fall through this router unmatched.
 * createPaymentUrl's `req.body` was always `undefined`, 500ing right after
 * order creation succeeded (an order with no way to pay for it).
 */
export const paymentIpnRouter = Router();
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
