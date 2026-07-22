import { Router } from "express";
import { authenticateStaff } from "../middleware/authenticateStaff.js";
import { validate } from "../middleware/validate.js";
import * as SupplierController from "../controllers/supplier.controller.js";
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierParamsSchema,
} from "../schemas/supplier.schema.js";

const router = Router();

router.use(authenticateStaff);

router.get("/", SupplierController.listSuppliers);
router.post(
  "/",
  validate(createSupplierSchema),
  SupplierController.createSupplier,
);
router.get(
  "/:supplier_id",
  validate(supplierParamsSchema),
  SupplierController.getSupplier,
);
router.put(
  "/:supplier_id",
  validate(updateSupplierSchema),
  SupplierController.updateSupplier,
);
router.delete(
  "/:supplier_id",
  validate(supplierParamsSchema),
  SupplierController.deleteSupplier,
);

export default router;
