import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import * as VoucherController from "../controllers/voucher.controller.js";
import {
  validateVoucherSchema,
  listAvailableVouchersSchema,
} from "../schemas/voucher.schema.js";

/**
 * Customer-facing voucher routes — mounted at /api/vouchers.
 *
 * Staff voucher management (create, list, update, discounts) lives in
 * admin.routes.ts under /api/admin/vouchers and /api/admin/discounts.
 */
const router = Router();

// GET /api/vouchers/available — browse vouchers the customer could apply
router.get(
  "/available",
  authenticate,
  validate(listAvailableVouchersSchema),
  VoucherController.listAvailableVouchers,
);

// POST /api/vouchers/validate — check a code at checkout
router.post(
  "/validate",
  authenticate,
  validate(validateVoucherSchema),
  VoucherController.validateVoucher,
);

export default router;
