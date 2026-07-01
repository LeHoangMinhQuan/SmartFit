import { Router, urlencoded } from "express";
import { authenticate } from "../middleware/authenticate.js";
import * as PaymentController from "../controllers/payment.controller.js";

const router = Router();

/**
 * ⚠️  IPN MUST be registered BEFORE express.json() in app.ts.
 * VNPay sends IPN as application/x-www-form-urlencoded.
 * Using express.urlencoded here as a route-scoped middleware.
 *
 * In app.ts, mount this router BEFORE `app.use(express.json())`.
 */
router.post(
  "/vnpay/ipn",
  urlencoded({ extended: false }),
  PaymentController.vnpayIpn,
);

// These two can be after json() middleware
router.post("/vnpay/create", authenticate, PaymentController.createPaymentUrl);
router.get("/vnpay/return", PaymentController.vnpayReturn);

export default router;
