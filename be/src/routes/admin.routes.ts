import { Router } from "express";
import { authenticateStaff } from "../middleware/authenticateStaff.js";
import * as Admin from "../controllers/admin.controller.js";
import * as OrderController from "../controllers/order.controller.js";
import { updateOrderStatusSchema } from "../schemas/order.schema.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// ─── Staff Auth (public — no authenticateStaff guard here) ───────────────────
router.post("/staff/auth/login", Admin.staffLogin);

// All routes below require staff JWT
router.use(authenticateStaff);
router.post("/staff/auth/logout", Admin.staffLogout);

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get("/dashboard", Admin.getDashboard);

// ─── Staff management ─────────────────────────────────────────────────────────
router.get("/staff", Admin.listStaff);
router.post("/staff", Admin.createStaff);
router.get("/staff/:staff_id", Admin.getStaff);
router.patch("/staff/:staff_id", Admin.updateStaff);
router.post("/staff/:staff_id/roles", Admin.assignRole);
router.delete("/staff/:staff_id/roles/:role_id", Admin.removeRole);
router.get("/staff/:staff_id/history", Admin.getStaffHistory);
router.get("/staff/:staff_id/store", Admin.getCurrentStore);
router.post("/staff/:staff_id/transfer", Admin.transferStaff);

// ─── Roles ────────────────────────────────────────────────────────────────────
router.get("/roles", Admin.listRoles);
router.post("/roles", Admin.createRole);

// ─── Stores ───────────────────────────────────────────────────────────────────
router.get("/stores", Admin.listStores);
router.post("/stores", Admin.createStore);
router.get("/stores/:store_id", Admin.getStore);
router.patch("/stores/:store_id", Admin.updateStore);
router.get("/stores/:store_id/inventory", Admin.getStoreInventory);
router.get("/stores/:store_id/staff", Admin.getStoreStaff);

// ─── Inventory ────────────────────────────────────────────────────────────────
router.get("/inventory", Admin.listInventory);
router.patch(
  "/inventory/:product_id/:variant_id/:store_id",
  Admin.adjustQuantity,
);
router.get("/inventory/import-history", Admin.getImportHistory);
router.post("/inventory/import", Admin.recordImport);

// ─── Suppliers ────────────────────────────────────────────────────────────────
router.get("/suppliers", Admin.listSuppliers);
router.post("/suppliers", Admin.createSupplier);
router.put("/suppliers/:supplier_id", Admin.updateSupplier);
router.delete("/suppliers/:supplier_id", Admin.deleteSupplier);

// ─── Users ────────────────────────────────────────────────────────────────────
router.get("/users", Admin.listUsers);
router.get("/users/:user_id", Admin.getUser);

// ─── Reviews ─────────────────────────────────────────────────────────────────
router.get("/reviews", Admin.listReviews);
router.delete(
  "/reviews/:product_id/:variant_id/:user_id/:review_id",
  Admin.adminDeleteReview,
);

// ─── Orders ──────────────────────────────────────────────────────────────────
router.get("/orders", Admin.adminListOrders);
router.get("/orders/:order_id", Admin.adminGetOrder);
router.patch(
  "/orders/:order_id/status",
  validate(updateOrderStatusSchema),
  Admin.adminUpdateOrderStatus,
);

export default router;
