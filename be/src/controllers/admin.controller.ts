import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as StaffService from "../services/staff.service.js";
import * as InventoryService from "../services/inventory.service.js";
import * as ReviewModel from "../models/review.model.js";
import * as OrderService from "../services/order.service.js";
import * as StoreProductModel from "../models/store_product.model.js";
import db from "../config/db.js";
import { env } from "../config/env.js";

// ─── Staff Auth ───────────────────────────────────────────────────────────────
import jwt from "jsonwebtoken";

export const staffLogin = catchAsync(async (req: Request, res: Response) => {
  const { staff_id, password } = req.body;
  const staff = await StaffService.verifyStaffPassword(
    Number(staff_id),
    password,
  );
  const roles = await (
    await import("../models/staff.model.js")
  ).findStaffRoles(staff.staff_id);

  const accessToken = jwt.sign(
    {
      staff_id: staff.staff_id,
      name: staff.name,
      roles: roles.map((r: any) => r.name),
    },
    env.STAFF_JWT_SECRET,
    { expiresIn: "8h" },
  );

  res.json({
    data: { staff_id: staff.staff_id, name: staff.name, roles, accessToken },
  });
});

export const staffLogout = catchAsync(async (_req: Request, res: Response) => {
  res.json({ data: { message: "Logged out" } });
});

// ─── Staff CRUD ───────────────────────────────────────────────────────────────

export const listStaff = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as any;
  const result = await StaffService.listStaff(page, limit);
  res.json({ data: result.rows, meta: { total: result.total } });
});

export const getStaff = catchAsync(async (req: Request, res: Response) => {
  const staff = await StaffService.getStaff(Number(req.params["staff_id"]));
  res.json({ data: staff });
});

export const createStaff = catchAsync(async (req: Request, res: Response) => {
  const result = await StaffService.createStaff(req.body);
  res.status(201).json({ data: result });
});

export const updateStaff = catchAsync(async (req: Request, res: Response) => {
  await StaffService.updateStaff(Number(req.params["staff_id"]), req.body);
  res.json({ data: { message: "Staff updated" } });
});

export const assignRole = catchAsync(async (req: Request, res: Response) => {
  await StaffService.assignRole(Number(req.params["staff_id"]), req.body.role_id);
  res.status(201).json({ data: { message: "Role assigned" } });
});

export const removeRole = catchAsync(async (req: Request, res: Response) => {
  await StaffService.removeRole(
    Number(req.params["staff_id"]),
    Number(req.params["role_id"]),
  );
  res.status(204).send();
});

export const getStaffHistory = catchAsync(
  async (req: Request, res: Response) => {
    const history = await StaffService.getStaffHistory(
      Number(req.params["staff_id"]),
    );
    res.json({ data: history });
  },
);

export const getCurrentStore = catchAsync(
  async (req: Request, res: Response) => {
    const assignment = await StaffService.getCurrentStoreAssignment(
      Number(req.params["staff_id"]),
    );
    res.json({ data: assignment ?? null });
  },
);

export const transferStaff = catchAsync(async (req: Request, res: Response) => {
  await StaffService.transferStaff(
    Number(req.params["staff_id"]),
    req.body.store_id,
    req.body.start_date,
  );
  res.json({ data: { message: "Staff transferred" } });
});

// ─── Roles ────────────────────────────────────────────────────────────────────

export const listRoles = catchAsync(async (_req: Request, res: Response) => {
  const roles = await StaffService.listRoles();
  res.json({ data: roles });
});

export const createRole = catchAsync(async (req: Request, res: Response) => {
  const result = await StaffService.createRole(req.body.name);
  res.status(201).json({ data: result });
});

// ─── Stores ───────────────────────────────────────────────────────────────────

export const listStores = catchAsync(async (_req: Request, res: Response) => {
  const stores = await StaffService.listStores();
  res.json({ data: stores });
});

export const getStore = catchAsync(async (req: Request, res: Response) => {
  const store = await StaffService.getStore(Number(req.params["store_id"]));
  res.json({ data: store });
});

export const createStore = catchAsync(async (req: Request, res: Response) => {
  const result = await StaffService.createStore(req.body);
  res.status(201).json({ data: result });
});

export const updateStore = catchAsync(async (req: Request, res: Response) => {
  await StaffService.updateStore(Number(req.params["store_id"]), req.body);
  res.json({ data: { message: "Store updated" } });
});

export const getStoreInventory = catchAsync(
  async (req: Request, res: Response) => {
    const inventory = await StoreProductModel.findInventoryByStore(
      Number(req.params["store_id"]),
    );
    res.json({ data: inventory });
  },
);

export const getStoreStaff = catchAsync(async (req: Request, res: Response) => {
  const { findStaffAtStore } = await import("../models/store.model.js");
  const staff = await findStaffAtStore(Number(req.params["store_id"]));
  res.json({ data: staff });
});

// ─── Inventory ────────────────────────────────────────────────────────────────

export const listInventory = catchAsync(async (req: Request, res: Response) => {
  const result = await InventoryService.listInventory(req.query as any);
  res.json({ data: result.rows, meta: { total: result.total } });
});

export const adjustQuantity = catchAsync(
  async (req: Request, res: Response) => {
    const { product_id, variant_id, store_id } = req.params;
    await InventoryService.adjustQuantity(
      Number(product_id),
      Number(variant_id),
      Number(store_id),
      req.body.quantity,
    );
    res.json({ data: { message: "Quantity updated" } });
  },
);

export const getImportHistory = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InventoryService.getImportHistory(req.query as any);
    res.json({ data: result.rows, meta: { total: result.total } });
  },
);

export const recordImport = catchAsync(async (req: Request, res: Response) => {
  const staff_id = (req as any).staff.staff_id;
  await InventoryService.recordImport({ ...req.body, staff_id });
  res.status(201).json({ data: { message: "Import recorded" } });
});

export const listSuppliers = catchAsync(
  async (_req: Request, res: Response) => {
    const suppliers = await InventoryService.listSuppliers();
    res.json({ data: suppliers });
  },
);

export const createSupplier = catchAsync(
  async (req: Request, res: Response) => {
    const result = await InventoryService.createSupplier(req.body.name);
    res.status(201).json({ data: result });
  },
);

export const updateSupplier = catchAsync(
  async (req: Request, res: Response) => {
    await InventoryService.updateSupplier(
      Number(req.params["supplier_id"]),
      req.body.name,
    );
    res.json({ data: { message: "Supplier updated" } });
  },
);

export const deleteSupplier = catchAsync(
  async (req: Request, res: Response) => {
    await InventoryService.deleteSupplier(Number(req.params["supplier_id"]));
    res.status(204).send();
  },
);

// ─── Users ────────────────────────────────────────────────────────────────────

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query as any;
  const offset = (Number(page) - 1) * Number(limit);
  const rows = await db('"USER"')
    .select("user_id", "username", "email", "phone", "created_at")
    .limit(Number(limit))
    .offset(offset);
  const total  = await db('"USER"').count("user_id as total");
  res.json({ data: rows, meta: { total: Number(total) } });
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  const user = await db('"USER"')
    .where({ user_id: req.params["user_id"] })
    .select("user_id", "username", "email", "phone", "address", "created_at")
    .first();
  if (!user) {
    res.status(404).json({ status: "error", message: "User not found" });
    return;
  }
  res.json({ data: user });
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const listReviews = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as any;
  const result = await ReviewModel.findAllReviews(page, limit);
  res.json({ data: result.rows, meta: { total: result.total } });
});

export const adminDeleteReview = catchAsync(
  async (req: Request, res: Response) => {
    const { product_id, variant_id, user_id, review_id } = req.params;
    await ReviewModel.adminDeleteReview(
      Number(product_id),
      Number(variant_id),
      Number(user_id),
      Number(review_id),
    );
    res.status(204).send();
  },
);

// ─── Orders ──────────────────────────────────────────────────────────────────

export const adminListOrders = catchAsync(
  async (req: Request, res: Response) => {
    const result = await OrderService.adminListOrders(req.query as any);
    res.json({ data: result.rows, meta: { total: result.total } });
  },
);

export const adminGetOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.adminGetOrderDetail(
    Number(req.params['order_id']),
  );
  res.json({ data: result });
});

export const adminUpdateOrderStatus = catchAsync(
  async (req: Request, res: Response) => {
    await OrderService.adminUpdateStatus(
      Number(req.params['order_id']),
      req.body.status,
    );
    res.json({ data: { message: "Status updated" } });
  },
);

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getDashboard = catchAsync(async (_req: Request, res: Response) => {
  const [
    total_revenue,
    total_orders,
    new_users,
    ordersByStatus,
    topProducts,
  ] = await Promise.all([
    db('"ORDER"')
      .whereIn("status", ["paid", "preparing", "shipping", "delivered"])
      .sum("total_amount as total_revenue"),
    db('"ORDER"').count("order_id as total_orders"),
    db('"USER"')
      .where("created_at", ">=", db.raw("NOW() - INTERVAL '30 days'"))
      .count("user_id as new_users"),
    db('"ORDER"').select("status").count("order_id as count").groupBy("status"),
    db("order_item as oi")
      .join("product as p", "oi.product_id", "p.product_id")
      .select(
        "oi.product_id",
        "p.name",
        db.raw("SUM(oi.quantity) as total_sold"),
      )
      .groupBy("oi.product_id", "p.name")
      .orderBy("total_sold", "desc")
      .limit(5),
  ]);

  res.json({
    data: {
      total_revenue: Number(total_revenue ?? 0),
      total_orders: Number(total_orders),
      new_users_last_30d: Number(new_users),
      orders_by_status: ordersByStatus,
      top_products: topProducts,
    },
  });
});

// ─── Vouchers (staff-facing) ──────────────────────────────────────────────────
import * as VoucherService from "../services/voucher.service.js";
import {
  createVoucherSchema,
  updateVoucherSchema,
  createDiscountSchema,
  assignDiscountSchema,
} from "../schemas/voucher.schema.js";

export const adminListVouchers = catchAsync(
  async (req: Request, res: Response) => {
    const { page, limit } = req.query as any;
    const result = await VoucherService.adminListVouchers(
      Number(page ?? 1),
      Number(limit ?? 20),
    );
    res.json({ data: result.rows, meta: { total: result.total } });
  },
);

export const adminCreateVoucher = catchAsync(
  async (req: Request, res: Response) => {
    const result = await VoucherService.adminCreateVoucher(req.body);
    res.status(201).json({ data: result });
  },
);

export const adminUpdateVoucher = catchAsync(
  async (req: Request, res: Response) => {
    await VoucherService.adminUpdateVoucher(
      Number(req.params['voucher_id']),
      req.body,
    );
    res.json({ data: { message: "Voucher updated" } });
  },
);

export const listDiscounts = catchAsync(
  async (_req: Request, res: Response) => {
    const discounts = await VoucherService.listDiscounts();
    res.json({ data: discounts });
  },
);

export const createDiscount = catchAsync(
  async (req: Request, res: Response) => {
    const result = await VoucherService.createDiscount(req.body);
    res.status(201).json({ data: result });
  },
);

export const assignDiscount = catchAsync(
  async (req: Request, res: Response) => {
    await VoucherService.assignDiscount(
      Number(req.params["discount_id"]),
      req.body.product_id,
      req.body.variant_id,
    );
    res.status(201).json({ data: { message: "Discount assigned" } });
  },
);

export const deleteDiscount = catchAsync(
  async (req: Request, res: Response) => {
    await VoucherService.deleteDiscount(Number(req.params["discount_id"]));
    res.status(204).send();
  },
);
