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

// Tracking (requires login)
router.get(
  "/track/:tracking_code",
  authenticate,
  ShippingController.trackOrder,
);

// GHN webhook (no auth — verified by GHN token in config)
router.post("/webhook", ShippingController.ghnWebhook);

export default router;
