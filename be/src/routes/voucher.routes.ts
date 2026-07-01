import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authenticateStaff } from "../middleware/authenticateStaff.js";
import { validate } from "../middleware/validate.js";
import * as VoucherController from "../controllers/voucher.controller.js";
import {
  validateVoucherSchema,
  createVoucherSchema,
  updateVoucherSchema,
  createDiscountSchema,
  assignDiscountSchema,
} from "../schemas/voucher.schema.js";

const router = Router();

// Customer — validate a voucher code at checkout
router.post(
  "/validate",
  authenticate,
  validate(validateVoucherSchema),
  VoucherController.validateVoucher,
);

// Admin — voucher management
router.get("/admin", authenticateStaff, VoucherController.adminListVouchers);
router.post(
  "/admin",
  authenticateStaff,
  validate(createVoucherSchema),
  VoucherController.adminCreateVoucher,
);
router.patch(
  "/admin/:voucher_id",
  authenticateStaff,
  validate(updateVoucherSchema),
  VoucherController.adminUpdateVoucher,
);

// Admin — discount management
router.get("/discounts", authenticateStaff, VoucherController.listDiscounts);
router.post(
  "/discounts",
  authenticateStaff,
  validate(createDiscountSchema),
  VoucherController.createDiscount,
);
router.post(
  "/discounts/:discount_id/products",
  authenticateStaff,
  validate(assignDiscountSchema),
  VoucherController.assignDiscount,
);
router.delete(
  "/discounts/:discount_id",
  authenticateStaff,
  VoucherController.deleteDiscount,
);

export default router;
