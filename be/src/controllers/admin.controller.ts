import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { catchAsync } from "../utils/catchAsync.js";
import {
  signStaffAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
} from "../utils/jwt.js";
import {
  createStaffRefreshToken,
  findStaffRefreshTokenByHash,
  deleteStaffRefreshToken,
} from "../models/staff-refresh-token.model.js";
import { findStaffById, findStaffRoles } from "../models/staff.model.js";
import * as StaffService from "../services/staff.service.js";
import * as InventoryService from "../services/inventory.service.js";
import * as ReviewModel from "../models/review.model.js";
import * as OrderService from "../services/order.service.js";
import * as VNPayService from "../services/vnpay.service.js";
import * as StoreProductModel from "../models/store_product.model.js";
import db from "../config/db.js";
import { env } from "../config/env.js";
// no more `import jwt from "jsonwebtoken"` — signing now goes through jwt.ts

// ─── Staff Auth ───────────────────────────────────────────────────────────────
const STAFF_REFRESH_COOKIE = "staff_refresh_token";
const staffRefreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/admin/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

async function issueStaffAccessToken(staff: {
  staff_id: number;
  name: string;
}) {
  const roles = await findStaffRoles(staff.staff_id);
  const accessToken = signStaffAccessToken({
    staff_id: staff.staff_id,
    name: staff.name,
  });
  return { accessToken, roles };
}

export const staffLogin = catchAsync(async (req: Request, res: Response) => {
  const { staff_id, password } = req.body;
  const staff = await StaffService.verifyStaffPassword(
    Number(staff_id),
    password,
  );
  const { accessToken, roles } = await issueStaffAccessToken(staff);

  const rawRefreshToken = generateRefreshToken();
  await createStaffRefreshToken(
    staff.staff_id,
    hashRefreshToken(rawRefreshToken),
    refreshTokenExpiresAt(),
  );
  res.cookie(STAFF_REFRESH_COOKIE, rawRefreshToken, staffRefreshCookieOptions);

  res.json({
    data: { staff_id: staff.staff_id, name: staff.name, roles, accessToken },
  });
});

export const staffRefresh = catchAsync(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[STAFF_REFRESH_COOKIE];
  if (!rawToken) throw new ApiError(401, "Refresh token missing");

  const row = await findStaffRefreshTokenByHash(hashRefreshToken(rawToken));
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    if (row) await deleteStaffRefreshToken(row.staff_id, row.token_id);
    res.clearCookie(STAFF_REFRESH_COOKIE, {
      path: staffRefreshCookieOptions.path,
    });
    throw new ApiError(401, "Refresh token invalid or expired");
  }

  const staff = await findStaffById(row.staff_id);
  if (!staff) throw new ApiError(401, "Refresh token invalid or expired");

  await deleteStaffRefreshToken(row.staff_id, row.token_id);
  const newRawToken = generateRefreshToken();
  await createStaffRefreshToken(
    staff.staff_id,
    hashRefreshToken(newRawToken),
    refreshTokenExpiresAt(),
  );
  res.cookie(STAFF_REFRESH_COOKIE, newRawToken, staffRefreshCookieOptions);

  const { accessToken, roles } = await issueStaffAccessToken(staff);
  res.json({
    data: { staff_id: staff.staff_id, name: staff.name, roles, accessToken },
  });
});

export const staffLogout = catchAsync(async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[STAFF_REFRESH_COOKIE];
  if (rawToken) {
    const row = await findStaffRefreshTokenByHash(hashRefreshToken(rawToken));
    if (row) await deleteStaffRefreshToken(row.staff_id, row.token_id);
  }
  res.clearCookie(STAFF_REFRESH_COOKIE, {
    path: staffRefreshCookieOptions.path,
  });
  res.json({ data: { message: "Logged out" } });
});

// ─── Staff CRUD ───────────────────────────────────────────────────────────────

export const listStaff = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, assignable } = req.query as any;
  // assignable=true excludes the SYSTEM_STAFF_ID placeholder account
  // ("System", staff_id=1) — used by the order-assign combobox, which must
  // never offer it as a real handler. Selecting it would silently write
  // staff_id back to the exact value that means "unclaimed" (see
  // OrderService.adminAssignStaff), making the assignment look like a
  // no-op even though the write succeeded. The general staff-management
  // list intentionally keeps showing the System row (page unaffected),
  // since an admin does still need to see/manage it there.
  const result = await StaffService.listStaff(
    page,
    limit,
    assignable === "true",
  );
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
  await StaffService.assignRole(
    Number(req.params["staff_id"]),
    req.body.role_id,
  );
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

export const setStoreActive = catchAsync(
  async (req: Request, res: Response) => {
    await StaffService.setStoreActive(
      Number(req.params["store_id"]),
      req.body.is_active,
    );
    res.json({ data: { message: "Store status updated" } });
  },
);

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
  const { page, limit } = req.query as any;
  const result = await InventoryService.listInventory(req.query as any);
  // BUG FIX: this used to return meta: { total } only — no page/limit/
  // totalPages — so the frontend had nothing to build a Pagination
  // component from (see getImportHistory just below, which already did
  // this correctly; listInventory was never brought in line with it).
  // Matches PaginationMeta / the import-history response shape exactly.
  const limitNum = Number(limit ?? 50);
  res.json({
    data: result.rows,
    meta: {
      page: Number(page ?? 1),
      limit: limitNum,
      total: result.total,
      totalPages: Math.ceil(result.total / limitNum),
    },
  });
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
    const { page, limit } = req.query as any;
    const result = await InventoryService.getImportHistory(req.query as any);
    const limitNum = Number(limit ?? 50);
    res.json({
      data: result.rows,
      meta: {
        page: Number(page ?? 1),
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum),
      },
    });
  },
);

export const recordImport = catchAsync(async (req: Request, res: Response) => {
  const staff_id = (req as any).staff.staff_id;
  await InventoryService.recordImport({ ...req.body, staff_id });
  res.status(201).json({ data: { message: "Import recorded" } });
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, search } = req.query as any;
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const offset = (pageNum - 1) * limitNum;
  // `search` powers the staff orders page's user Combobox (search by
  // username instead of typing a raw user_id) — matches products'
  // ILIKE-on-name search (see product.model.ts's searchProducts), same
  // "%term%" pattern, case-insensitive.
  const query = db("USER").modify((qb) => {
    if (search) qb.whereILike("username", `%${search}%`);
  });
  const rows = await query
    .clone()
    .select("user_id", "username", "email", "phone", "created_at")
    .limit(limitNum)
    .offset(offset);
  const totalResult = await query.clone().count("user_id as total");
  // BUG FIX: `total` was `Number([{ total: "N" }])` — count() returns an
  // array of one row, and Number() on an array (via its default
  // toString(), "[object Object]" once stringified) is NaN, not the
  // count. Same "meta is missing/wrong" family of bug as adminListOrders
  // — pull the row's `total` field out first, and return the full
  // PaginationMeta shape (page/limit/total/totalPages) the frontend's
  // <Pagination> component actually reads, same as the orders-list fix.
  const total = Number(totalResult[0]?.["total"] ?? 0);
  res.json({
    data: rows,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  const user = await db("USER")
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
  const { page = 1, limit = 20 } = req.query as any;
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const result = await ReviewModel.findAllReviews(pageNum, limitNum);
  // Same incomplete-meta bug as adminListOrders/listUsers (see those
  // fixes) — return the full PaginationMeta shape the frontend's
  // <Pagination>/DataTable expect.
  res.json({
    data: result.rows,
    meta: {
      page: pageNum,
      limit: limitNum,
      total: result.total,
      totalPages: Math.ceil(result.total / limitNum),
    },
  });
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
    // needs_fulfillment/unclaimed arrive as the string "true"/"false" over
    // the querystring — coerce explicitly rather than passing the raw
    // string through, since a truthy-string check would treat "false" as
    // true too.
    const { needs_fulfillment, unclaimed, ...rest } = req.query as any;
    const result = await OrderService.adminListOrders({
      ...rest,
      needs_fulfillment: needs_fulfillment === "true",
      unclaimed: unclaimed === "true",
    });
    // BUG FIX: this was returning only `{ total }` in meta, unlike
    // listInventory/getImportHistory which return the full PaginationMeta
    // shape (page/limit/total/totalPages — see interfaces.tsx on the
    // frontend). The frontend's <Pagination> component reads
    // `meta.totalPages` to decide whether to render at all
    // (`if (totalPages <= 1) return null`) and to build its page-button
    // list — with totalPages undefined that comparison is always false,
    // so pagination rendered in a broken state and staff couldn't page
    // past the first 20 results of a filtered/unfiltered list, making
    // filtering look broken (results seemed "stuck"/incomplete).
    const page = Number((req.query as any).page ?? 1);
    const limit = Number((req.query as any).limit ?? 20);
    res.json({
      data: result.rows,
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  },
);

// Manual "retry GHN shipment" action — see OrderService.retryShipment's
// doc comment. Surfaced on the order detail page for orders that were
// confirmed but never got a tracking code. required_note is optional —
// staff can pick one, or leave it to the service's default.
export const adminRetryShipment = catchAsync(
  async (req: Request, res: Response) => {
    const result = await OrderService.retryShipment(
      Number(req.params["order_id"]),
      req.body?.required_note,
    );
    res.json({ data: result });
  },
);

// Change which required_note option an EXISTING shipment was created
// with — see OrderService.updateShipmentRequiredNote's doc comment.
export const adminUpdateShipmentRequiredNote = catchAsync(
  async (req: Request, res: Response) => {
    const result = await OrderService.updateShipmentRequiredNote(
      Number(req.params["order_id"]),
      req.body.required_note,
    );
    res.json({ data: result });
  },
);

export const adminGetOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.adminGetOrderDetail(
    Number(req.params["order_id"]),
  );
  res.json({ data: result });
});

export const adminUpdateOrderStatus = catchAsync(
  async (req: Request, res: Response) => {
    await OrderService.adminUpdateStatus(
      Number(req.params["order_id"]),
      req.body.status,
      (req as any).staff.staff_id,
    );
    res.json({ data: { message: "Status updated" } });
  },
);

export const adminAssignOrderStaff = catchAsync(
  async (req: Request, res: Response) => {
    await OrderService.adminAssignStaff(
      Number(req.params["order_id"]),
      Number(req.body.staff_id),
    );
    res.json({ data: { message: "Order assigned" } });
  },
);

export const adminProcessRefund = catchAsync(
  async (req: Request, res: Response) => {
    const staff_id = (req as any).staff.staff_id;
    const result = await VNPayService.processRefund(
      Number(req.params["order_id"]),
      staff_id,
      req.body.reason,
    );
    res.json({ data: result });
  },
);

// Same "real sale" status set used elsewhere on this dashboard (top
// products, revenue) — orders that were never actually paid for
// (pending_payment, payment_failed, cancelled before payment) shouldn't
// count as revenue or sales activity.
const REAL_SALE_STATUSES = ["paid", "preparing", "shipping", "delivered"];

// Placeholder staff_id every order starts on before a staff member claims
// it (see order.model.ts's own SYSTEM_STAFF_ID comment) and the statuses
// a confirmed order can be stuck in while still missing its GHN shipment
// (order.model.ts's STUCK_SHIPMENT_STATUSES). Duplicated here rather than
// imported — same convention as order.service.ts's RETRYABLE_SHIPMENT_STATUSES:
// avoids a circular import between model/service and this controller, and
// each copy is a plain literal that isn't going to drift silently since
// it's checked against the same fixed schema CHECK constraint everywhere.
const SYSTEM_STAFF_ID = 1;
const STUCK_SHIPMENT_STATUSES = ["paid", "cod_confirmed"];

/**
 * Parses optional ?from=&to= query params (ISO date strings, e.g.
 * "2026-07-01") into a [from, to) range. Both are optional and
 * independent — a lone `from` means "since then", a lone `to` means "up
 * to then", neither means all-time (the dashboard's original behavior,
 * preserved as the default so existing bookmarks/links keep working).
 * `to` is treated as inclusive-of-that-day by adding one day, since a
 * bare date string parses to that day's 00:00:00 otherwise and would
 * silently exclude the selected end day's own orders.
 */
function parseDashboardRange(req: Request): { from?: Date; to?: Date } {
  const { from, to } = req.query as { from?: string; to?: string };
  const result: { from?: Date; to?: Date } = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) result.from = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() + 1);
      result.to = d;
    }
  }
  return result;
}

function applyDateRange(
  query: any,
  column: string,
  range: { from?: Date; to?: Date },
): any {
  if (range.from) query = query.where(column, ">=", range.from);
  if (range.to) query = query.where(column, "<", range.to);
  return query;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getDashboard = catchAsync(async (req: Request, res: Response) => {
  const range = parseDashboardRange(req);

  const [
    total_revenue,
    total_orders,
    new_users,
    ordersByStatus,
    topProducts,
    revenueSeries,
    unclaimedCount,
    needsFulfillmentCount,
  ] = await Promise.all([
    applyDateRange(
      db("ORDER").whereIn("status", REAL_SALE_STATUSES),
      "created_at",
      range,
    ).sum("total_amount as total_revenue"),
    applyDateRange(db("ORDER"), "created_at", range).count(
      "order_id as total_orders",
    ),
    // "New users" always means the trailing 30 days, independent of the
    // dashboard's selected range — it's a fixed-window signup-velocity
    // metric, not a report over the chosen range, so it deliberately
    // doesn't take `range` (a `from`/`to` far in the past would otherwise
    // make this card claim near-zero new users, which isn't what it's
    // asking).
    db("USER")
      .where("created_at", ">=", db.raw("NOW() - INTERVAL '30 days'"))
      .count("user_id as new_users"),
    applyDateRange(db("ORDER"), "created_at", range)
      .select("status")
      .count("order_id as count")
      .groupBy("status"),
    applyDateRange(
      db("order_item as oi")
        .join("product as p", "oi.product_id", "p.product_id")
        .join("ORDER as o", "oi.order_id", "o.order_id")
        .select(
          "oi.product_id",
          "p.name",
          db.raw("SUM(oi.quantity) as sold"),
          db.raw("SUM(oi.subtotal) as revenue"),
        )
        .whereIn("o.status", REAL_SALE_STATUSES),
      "o.created_at",
      range,
    )
      .groupBy("oi.product_id", "p.name")
      .orderBy("sold", "desc")
      .limit(5),
    // Daily revenue rollup for the dashboard's trend chart — same
    // REAL_SALE_STATUSES filter as total_revenue above so the chart and
    // the KPI card it sits next to always agree with each other. Capped
    // to the selected range when one is given; when no range is
    // selected, capped to the trailing 90 days rather than truly
    // all-time, since an unbounded day-by-day series isn't a useful
    // chart on a store that's been running a while and would make every
    // OTHER day's bar invisible next to it.
    applyDateRange(
      db("ORDER").whereIn("status", REAL_SALE_STATUSES),
      "created_at",
      range.from || range.to
        ? range
        : { from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    )
      .select(db.raw("DATE(created_at) as date"))
      .select(db.raw("SUM(total_amount) as revenue"))
      .select(db.raw("COUNT(*) as order_count"))
      .groupByRaw("DATE(created_at)")
      .orderByRaw("DATE(created_at) ASC"),
    // ─── "Needs attention" — the dashboard's actionable/monitoring half ───
    // Deliberately NOT scoped to `range`: these are current operational
    // backlog counts ("how many things need handling right now"), not a
    // historical report — an unclaimed order from last week still needs
    // claiming today regardless of what date range is selected above.
    db("ORDER")
      .where("staff_id", SYSTEM_STAFF_ID)
      .whereNotIn("status", ["cancelled", "refunded", "payment_failed"])
      .count("order_id as count"),
    db("ORDER")
      .whereIn("status", STUCK_SHIPMENT_STATUSES)
      .whereNull("shipping_order_id")
      .count("order_id as count"),
  ]);

  const revenue = Number(total_revenue[0]?.["total_revenue"] ?? 0);
  const orders = Number(total_orders[0]?.["total_orders"] ?? 0);
  const newUsers = Number(new_users[0]?.["new_users"] ?? 0);

  res.json({
    data: {
      total_revenue: revenue,
      total_orders: orders,
      new_users_last_30d: newUsers,
      orders_by_status: ordersByStatus,
      top_products: topProducts.map((p: any) => ({
        product_id: p.product_id,
        name: p.name,
        sold: Number(p.sold),
        revenue: Number(p.revenue),
      })),
      revenue_series: revenueSeries.map((r: any) => ({
        date:
          r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
        revenue: Number(r.revenue),
        order_count: Number(r.order_count),
      })),
      needs_attention: {
        unclaimed_orders: Number(unclaimedCount[0]?.["count"] ?? 0),
        missing_shipment: Number(needsFulfillmentCount[0]?.["count"] ?? 0),
        // refund_requested is already a status, so it's available from
        // orders_by_status too — surfaced again here under
        // needs_attention purely so the frontend can render it in the
        // same actionable-cards row as the two counts above without
        // having to cross-reference two different parts of the payload.
        refund_requested: Number(
          (ordersByStatus as any[]).find((r) => r.status === "refund_requested")
            ?.count ?? 0,
        ),
      },
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
      Number(req.params["voucher_id"]),
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
      req.body.assignments,
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
