import { Router } from "express";
import { authenticateStaff } from "../middleware/authenticateStaff.js";
import { authorize } from "../middleware/authorize.js";
import * as Admin from "../controllers/admin.controller.js";
import {
  updateOrderStatusSchema,
  assignOrderStaffSchema,
  retryShipmentSchema,
  updateShipmentRequiredNoteSchema,
} from "../schemas/order.schema.js";
import { validate } from "../middleware/validate.js";
import {
  recordImportSchema,
  adjustQuantitySchema,
} from "../schemas/inventory.schema.js";

const router = Router();

// ─── Staff Auth (public — no authenticateStaff guard) ────────────────────────
router.post("/auth/login", Admin.staffLogin);
router.post("/auth/refresh", Admin.staffRefresh); // public — reads httpOnly cookie, not JWT

// Everything below requires a valid staff JWT
router.use(authenticateStaff);

router.post("/auth/logout", Admin.staffLogout);

// ─── Dashboard ────────────────────────────────────────────────────────────────
// Operational visibility — any staff account can view.
router.get("/dashboard", authorize("admin", "staff"), Admin.getDashboard);

// ─── Staff management ─────────────────────────────────────────────────────────
// Managing OTHER staff accounts and their roles is admin-only — a staff
// account being able to create/edit staff (or grant itself roles via
// assignRole) would be a privilege-escalation path, not an operational task.
router.get("/staff", authorize("admin"), Admin.listStaff);
router.post("/staff", authorize("admin"), Admin.createStaff);
router.get("/staff/:staff_id", authorize("admin"), Admin.getStaff);
router.patch("/staff/:staff_id", authorize("admin"), Admin.updateStaff);
router.post("/staff/:staff_id/roles", authorize("admin"), Admin.assignRole);
router.delete(
  "/staff/:staff_id/roles/:role_id",
  authorize("admin"),
  Admin.removeRole,
);
router.get(
  "/staff/:staff_id/history",
  authorize("admin"),
  Admin.getStaffHistory,
);
router.get("/staff/:staff_id/store", authorize("admin"), Admin.getCurrentStore);
router.post(
  "/staff/:staff_id/transfer",
  authorize("admin"),
  Admin.transferStaff,
);

// ─── Roles ────────────────────────────────────────────────────────────────────
// Same reasoning as Staff management above — who can hold which role is
// an admin-only concern.
router.get("/roles", authorize("admin"), Admin.listRoles);
router.post("/roles", authorize("admin"), Admin.createRole);

// ─── Stores ───────────────────────────────────────────────────────────────────
router.get("/stores", authorize("admin"), Admin.listStores);
router.post("/stores", authorize("admin"), Admin.createStore);
router.get("/stores/:store_id", authorize("admin"), Admin.getStore);
router.patch("/stores/:store_id", authorize("admin"), Admin.updateStore);
router.patch(
  "/stores/:store_id/status",
  authorize("admin"),
  Admin.setStoreActive,
);
router.get(
  "/stores/:store_id/inventory",
  authorize("admin"),
  Admin.getStoreInventory,
);
router.get("/stores/:store_id/staff", authorize("admin"), Admin.getStoreStaff);

// ─── Inventory ────────────────────────────────────────────────────────────────
// ⚠ Static paths (/import-history, /import) MUST come before the parameterised
// route (:product_id/:variant_id/:store_id) or Express matches the literal
// string "import-history" as the product_id param.
router.get("/inventory", authorize("admin", "staff"), Admin.listInventory);
router.get(
  "/inventory/import-history",
  authorize("admin", "staff"),
  Admin.getImportHistory,
);
router.post(
  "/inventory/import",
  authorize("admin", "staff"),
  validate(recordImportSchema),
  Admin.recordImport,
);
router.patch(
  "/inventory/:product_id/:variant_id/:store_id",
  authorize("admin", "staff"),
  validate(adjustQuantitySchema),
  Admin.adjustQuantity,
);

// ─── Users ────────────────────────────────────────────────────────────────────
// Customer account data — not day-to-day fulfillment work, kept admin-only
// per the "Staff CRUD, roles, stores, vouchers, discounts, users" bucket.
router.get("/users", authorize("admin"), Admin.listUsers);
router.get("/users/:user_id", authorize("admin"), Admin.getUser);

// ─── Orders ──────────────────────────────────────────────────────────────────
// Viewing orders is necessary to do fulfillment work, so list/detail are
// staff-allowed. The status-update endpoint is staff-allowed AT THE ROUTE
// LEVEL, but order.service.ts's adminUpdateStatus enforces a finer split
// on top of this per the agreed decision: staff can advance an order
// through ordinary fulfillment statuses, but setting the target status to
// "paid", "cancelled", or "refund_requested" requires the admin role —
// see ADMIN_ONLY_TARGET_STATUSES in that file for the full reasoning.
// The dedicated refund endpoint is a distinct route from status update
// (the original plan for this feature assumed refund only happened
// through the status-update endpoint — it doesn't; this route already
// existed) and is admin-only outright, consistent with "cancel/refund is
// admin-only".
router.get("/orders", authorize("admin", "staff"), Admin.adminListOrders);
router.get(
  "/orders/:order_id",
  authorize("admin", "staff"),
  Admin.adminGetOrder,
);
router.patch(
  "/orders/:order_id/status",
  authorize("admin", "staff"),
  validate(updateOrderStatusSchema),
  Admin.adminUpdateOrderStatus,
);
// Admin-only, direct assignment of an UNCLAIMED order to a specific staff
// member — see OrderService.adminAssignStaff's doc comment. Distinct from
// the implicit "first staff to touch it claims it" behavior baked into
// adminUpdateStatus above.
router.patch(
  "/orders/:order_id/assign",
  authorize("admin"),
  validate(assignOrderStaffSchema),
  Admin.adminAssignOrderStaff,
);
router.post(
  "/orders/:order_id/refund",
  authorize("admin"),
  Admin.adminProcessRefund,
);
// Retry GHN shipment creation for an order that was confirmed (paid or
// cod_confirmed) but never got a tracking code — staff-allowed, same as
// the rest of ordinary fulfillment work. required_note is optional in
// the body (staff-picked, see the order detail page's picker).
router.post(
  "/orders/:order_id/retry-shipment",
  authorize("admin", "staff"),
  validate(retryShipmentSchema),
  Admin.adminRetryShipment,
);
// Change required_note on an already-created shipment (GHN allows this
// via its Update Order API up until the shipment is picked up) —
// staff-allowed, same tier as retry-shipment above.
router.patch(
  "/orders/:order_id/shipment-note",
  authorize("admin", "staff"),
  validate(updateShipmentRequiredNoteSchema),
  Admin.adminUpdateShipmentRequiredNote,
);

// ─── Reviews ─────────────────────────────────────────────────────────────────
// Grouped with the other operational sections per the agreed
// classification — note this includes the delete route too, since
// "reviews" wasn't called out with a delete-specific exception the way
// products/categories/suppliers were. Revisit if moderation (deleting a
// customer's review) should actually be admin-only in practice.
router.get("/reviews", authorize("admin", "staff"), Admin.listReviews);
router.delete(
  "/reviews/:product_id/:variant_id/:user_id/:review_id",
  authorize("admin", "staff"),
  Admin.adminDeleteReview,
);

// ─── Vouchers (staff-facing) ──────────────────────────────────────────────────
router.get("/vouchers", authorize("admin"), Admin.adminListVouchers);
router.post("/vouchers", authorize("admin"), Admin.adminCreateVoucher);
router.patch(
  "/vouchers/:voucher_id",
  authorize("admin"),
  Admin.adminUpdateVoucher,
);

// ─── Discounts (variant-level markdowns) ─────────────────────────────────────
router.get("/discounts", authorize("admin"), Admin.listDiscounts);
router.post("/discounts", authorize("admin"), Admin.createDiscount);
router.post(
  "/discounts/:discount_id/products",
  authorize("admin"),
  Admin.assignDiscount,
);
router.delete(
  "/discounts/:discount_id",
  authorize("admin"),
  Admin.deleteDiscount,
);

export default router;
