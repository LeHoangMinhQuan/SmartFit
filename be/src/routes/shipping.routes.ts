import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import * as ShippingController from "../controllers/shipping.controller.js";

const router = Router();

// Location data (public)
router.get("/provinces", ShippingController.getProvinces);
router.get("/districts/:province_id", ShippingController.getDistricts);
router.get("/wards/:district_id", ShippingController.getWards);

// Fee / service estimation (requires login)
router.post("/services", authenticate, ShippingController.getAvailableServices);
router.post("/fee", authenticate, ShippingController.estimateFee);
router.post("/auto-select", authenticate, ShippingController.autoSelectService);

// Tracking (requires login)
router.get(
  "/track/:tracking_code",
  authenticate,
  ShippingController.trackOrder,
);

// GHN webhook — see shipping.controller.ts's ghnWebhook for the actual
// secret check (GHN doesn't sign payloads, so a secret path segment is
// the verification; see config/env.ts's GHN_WEBHOOK_SECRET comment).
// This must match exactly what's registered as the "Callback URL" in
// GHN's shop settings.
router.post("/webhook/:secret", ShippingController.ghnWebhook);

export default router;
