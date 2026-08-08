import { Router } from "express";
import { authenticateStaff } from "../middleware/authenticateStaff.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import * as SupplierController from "../controllers/supplier.controller.js";
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierParamsSchema,
} from "../schemas/supplier.schema.js";

const router = Router();

router.use(authenticateStaff);

// View/create/update are staff-allowed — supplier records are inventory
// workflow, same as product/category. Delete kept admin-only for
// consistency with the product/category/variant delete pattern, since the
// plan didn't call out an explicit exception here either way.
router.get("/", authorize("admin", "staff"), SupplierController.listSuppliers);
router.post(
  "/",
  authorize("admin", "staff"),
  validate(createSupplierSchema),
  SupplierController.createSupplier,
);
router.get(
  "/:supplier_id",
  authorize("admin", "staff"),
  validate(supplierParamsSchema),
  SupplierController.getSupplier,
);
router.put(
  "/:supplier_id",
  authorize("admin", "staff"),
  validate(updateSupplierSchema),
  SupplierController.updateSupplier,
);
router.delete(
  "/:supplier_id",
  authorize("admin"),
  validate(supplierParamsSchema),
  SupplierController.deleteSupplier,
);

export default router;
