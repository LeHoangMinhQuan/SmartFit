import api from "../../lib/staffAxios";
import type {
  GhnRequiredNote,
  Order,
  OrderStatus,
  PaginatedResponse,
  ProductVariant,
  Role,
  Staff,
  Store,
  User,
} from "../../interfaces";

// ─── API envelope ───────────────────────────────────────────────────────────
// Every admin controller responds with { data: T, meta?: { total } } — always
// unwrap with r.data.data, never r.data alone. (Exception: getAllOrders /
// getAllUsers use PaginatedResponse<T>, which already models this envelope
// shape directly, so a single r.data is correct there.)

interface ApiResponse<T> {
  data: T;
  meta?: { total: number };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_revenue: number;
  // Backend returns this as an array of grouped rows (SQL GROUP BY status —
  // see admin.controller.ts getDashboard), not a Record keyed by status.
  // `count` comes back as a string because Postgres COUNT() is bigint and
  // the pg driver stringifies bigints to avoid precision loss.
  orders_by_status: Array<{ status: OrderStatus; count: string | number }>;
  top_products: Array<{
    product_id: number;
    name: string;
    sold: number;
    revenue: number;
  }>;
  new_users_last_30d: number;
  // Daily rollup for the trend chart — capped to the trailing 90 days
  // when no from/to range is given (see admin.controller.ts's
  // getDashboard comment on why this isn't truly all-time by default).
  revenue_series: Array<{
    date: string; // "YYYY-MM-DD"
    revenue: number;
    order_count: number;
  }>;
  // Current operational backlog — NOT scoped to the selected from/to
  // range (see backend comment): these are "what needs handling right
  // now" counts, so each links to a pre-filtered orders list.
  needs_attention: {
    unclaimed_orders: number;
    missing_shipment: number;
    refund_requested: number;
  };
}

// ─── Products ─────────────────────────────────────────────────────────────────

interface CreateProductBody {
  name: string; // VARCHAR(20)
  description: string; // VARCHAR(100)
  // Used for real GHN shipping fee/service calculation — optional, falls
  // back to a placeholder parcel per item when unset.
  weight_grams?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
}

interface CreateVariantBody {
  variant_id: number; // app-supplied, per-product sequential int
  name: string;
}

interface PriceBody {
  base_price: number;
  start_date: string;
  end_date: string;
}

// ─── Attributes ───────────────────────────────────────────────────────────────

interface Attribute {
  attribute_id: number;
  name: string; // VARCHAR(20)
}

interface AttributeAssignBody {
  attribute_id: number;
  value: string; // VARCHAR(20)
}

// ─── Staff ────────────────────────────────────────────────────────────────────

interface CreateStaffBody {
  name: string;
  birth_date?: string;
  start_time?: string;
  password: string;
}

interface StaffHistory {
  history_id: number;
  staff_id: number;
  store_id: number;
  start_date: string;
  end_date: string | null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface StoreInventoryRow {
  product_id: number;
  variant_id: number;
  store_id: number;
  quantity: number;
}

// ─── Supplier ─────────────────────────────────────────────────────────────────

interface Supplier {
  supplier_id: number;
  name: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const adminService = {
  // Dashboard
  getDashboard: (params?: { from?: string; to?: string }) =>
    api
      .get<ApiResponse<DashboardStats>>("/admin/dashboard", { params })
      .then((r) => r.data.data),

  // ── Products ──
  createProduct: (body: CreateProductBody) =>
    api
      .post<ApiResponse<{ product_id: number }>>("/products", body)
      .then((r) => r.data.data),

  updateProduct: (product_id: number, body: Partial<CreateProductBody>) =>
    api
      .patch<ApiResponse<unknown>>(`/products/${product_id}`, body)
      .then((r) => r.data.data),

  setCategories: (product_id: number, category_ids: number[]) =>
    api
      .patch<ApiResponse<unknown>>(`/products/${product_id}`, { category_ids })
      .then((r) => r.data.data),

  deleteProduct: (product_id: number) =>
    api
      .delete<ApiResponse<unknown>>(`/products/${product_id}`)
      .then((r) => r.data.data),

  // Images — multipart, up to 10 files, 5 MB each, JPEG/PNG/WEBP
  uploadImages: (product_id: number, files: File[], variant_id?: number) => {
    const form = new FormData();
    files.forEach((f) => form.append("images", f));
    if (variant_id != null) form.append("variant_id", String(variant_id));
    return api
      .post<
        ApiResponse<{ image_ids: number[] }>
      >(`/products/${product_id}/images`, form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data.data);
  },

  // ── Variants ──
  createVariant: (product_id: number, body: CreateVariantBody) =>
    api
      .post<
        ApiResponse<ProductVariant>
      >(`/products/${product_id}/variants`, body)
      .then((r) => r.data.data),

  updateVariant: (
    product_id: number,
    variant_id: number,
    body: Partial<CreateVariantBody>,
  ) =>
    api
      .put<
        ApiResponse<unknown>
      >(`/products/${product_id}/variants/${variant_id}`, body)
      .then((r) => r.data.data),

  deleteVariant: (product_id: number, variant_id: number) =>
    api
      .delete<
        ApiResponse<unknown>
      >(`/products/${product_id}/variants/${variant_id}`)
      .then((r) => r.data.data),

  // One active price row per variant at any time
  upsertPrice: (product_id: number, variant_id: number, body: PriceBody) =>
    api
      .post<
        ApiResponse<unknown>
      >(`/products/${product_id}/variants/${variant_id}/price`, body)
      .then((r) => r.data.data),

  // ── Attributes ──
  getAttributes: () =>
    api.get<ApiResponse<Attribute[]>>("/attributes").then((r) => r.data.data),

  createAttribute: (body: { name: string }) =>
    api
      .post<ApiResponse<{ attribute_id: number }>>("/attributes", body)
      .then((r) => r.data.data),

  // product_attribute PK is (attribute_id, product_id, variant_id) — a given
  // attribute type can only be attached once per variant. Server returns 409
  // if it already exists; use updateAttributeValue instead.
  assignAttribute: (
    product_id: number,
    variant_id: number,
    body: AttributeAssignBody,
  ) =>
    api
      .post<
        ApiResponse<unknown>
      >(`/products/${product_id}/variants/${variant_id}/attributes`, body)
      .then((r) => r.data.data),

  updateAttributeValue: (
    product_id: number,
    variant_id: number,
    attribute_id: number,
    value: string,
  ) =>
    api
      .patch<
        ApiResponse<unknown>
      >(`/products/${product_id}/variants/${variant_id}/attributes/${attribute_id}`, { value })
      .then((r) => r.data.data),

  removeAttribute: (
    product_id: number,
    variant_id: number,
    attribute_id: number,
  ) =>
    api
      .delete<
        ApiResponse<unknown>
      >(`/products/${product_id}/variants/${variant_id}/attributes/${attribute_id}`)
      .then((r) => r.data.data),

  // ── Categories ──
  createCategory: (body: {
    name: string;
    parent_id?: number;
    is_featured?: boolean;
    display_order?: number | null;
  }) =>
    api
      .post<ApiResponse<{ category_id: number }>>("/categories", body)
      .then((r) => r.data.data),

  updateCategory: (
    category_id: number,
    body: {
      name?: string;
      parent_id?: number | null;
      is_featured?: boolean;
      display_order?: number | null;
    },
  ) =>
    api
      .put<ApiResponse<unknown>>(`/categories/${category_id}`, body)
      .then((r) => r.data.data),

  uploadCategoryImage: (category_id: number, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api
      .post<
        ApiResponse<{ image_url: string }>
      >(`/categories/${category_id}/image`, form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data.data);
  },

  deleteCategory: (category_id: number) =>
    api
      .delete<ApiResponse<unknown>>(`/categories/${category_id}`)
      .then((r) => r.data.data),

  // ── Orders ──
  // NOTE: PaginatedResponse<T> already models the { data, meta } envelope —
  // r.data is correct here, do not double-unwrap.
  getAllOrders: (params?: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    user_id?: number;
    // Matches order.model.ts's findAllOrders `from`/`to` filters (ISO
    // date strings, e.g. "2026-07-01") — used by both the staff orders
    // page's own date filter and dashboard "drill into this range"
    // links. (Replaces a vestigial unused `created_at` param that never
    // actually matched any backend filter name.)
    from?: string;
    to?: string;
    // Confirmed (paid/cod_confirmed) orders whose GHN shipment was never
    // created — see order.model.ts's STUCK_SHIPMENT_STATUSES. Surfaced as
    // a "Needs fulfillment" filter on the staff orders list so these
    // don't silently fall through the cracks.
    needs_fulfillment?: boolean;
    // Orders still on the SYSTEM_STAFF_ID placeholder (nobody has
    // claimed them). Backs the dashboard's "Unclaimed Orders" card.
    unclaimed?: boolean;
  }) =>
    api
      .get<PaginatedResponse<Order>>("/admin/orders", { params })
      .then((r) => r.data),

  // GET /admin/orders/:order_id — staff-scoped, no customer ownership check
  // (unlike orderService.getOrder, which is gated by the customer's
  // cookie-based `authenticate` and 401s under staff's separate
  // Bearer-token auth regardless of order status).
  getOrder: (order_id: number) =>
    api
      .get<ApiResponse<Order>>(`/admin/orders/${order_id}`)
      .then((r) => r.data.data),

  updateOrderStatus: (order_id: number, status: OrderStatus) =>
    api
      .patch<
        ApiResponse<unknown>
      >(`/admin/orders/${order_id}/status`, { status })
      .then((r) => r.data.data),

  // PATCH /admin/orders/:order_id/assign — admin-only, direct handoff of
  // an unclaimed order to a specific staff member (see the order detail
  // page's "Assign staff" combobox, shown when is_unclaimed is true).
  assignOrderStaff: (order_id: number, staff_id: number) =>
    api
      .patch<
        ApiResponse<unknown>
      >(`/admin/orders/${order_id}/assign`, { staff_id })
      .then((r) => r.data.data),

  // POST /admin/orders/:order_id/retry-shipment — manual recovery for an
  // order that was confirmed but never got a GHN shipment (no
  // tracking_code). See OrderService.retryShipment's doc comment. Shown
  // on the order detail page whenever shipping_order_id is null on a
  // paid/cod_confirmed order. required_note is optional — staff can pick
  // one via the picker, or leave it to the backend's default.
  retryShipment: (order_id: number, required_note?: GhnRequiredNote) =>
    api
      .post<
        ApiResponse<{ shipping_order_id: number; tracking_code: string }>
      >(`/admin/orders/${order_id}/retry-shipment`, { required_note })
      .then((r) => r.data.data),

  // PATCH /admin/orders/:order_id/shipment-note — change which
  // required_note option an EXISTING shipment was created with (GHN
  // allows this up until the shipment is picked up). See
  // OrderService.updateShipmentRequiredNote's doc comment.
  updateShipmentRequiredNote: (
    order_id: number,
    required_note: GhnRequiredNote,
  ) =>
    api
      .patch<
        ApiResponse<{ tracking_code: string; required_note: GhnRequiredNote }>
      >(`/admin/orders/${order_id}/shipment-note`, { required_note })
      .then((r) => r.data.data),

  // POST /admin/orders/:order_id/refund — only valid while the order is
  // 'refund_requested'. Staff-triggered, not automatic — see
  // order.service.ts's cancelOrder() for why a prepaid cancellation lands
  // in refund_requested instead of an instant cancel.
  processRefund: (order_id: number, reason?: string) =>
    api
      .post<
        ApiResponse<{ status: "success" | "failed"; message: string }>
      >(`/admin/orders/${order_id}/refund`, { reason })
      .then((r) => r.data.data),

  // ── Users ──
  // NOTE: same PaginatedResponse exception as getAllOrders above.
  getAllUsers: (params?: { page?: number; limit?: number }) =>
    api
      .get<PaginatedResponse<User>>("/admin/users", { params })
      .then((r) => r.data),

  getUser: (user_id: number) =>
    api
      .get<ApiResponse<User>>(`/admin/users/${user_id}`)
      .then((r) => r.data.data),

  // ── Reviews ──
  getAllReviews: () =>
    api.get<ApiResponse<unknown[]>>("/admin/reviews").then((r) => r.data.data),

  deleteReview: (
    product_id: number,
    variant_id: number,
    user_id: number,
    review_id: number,
  ) =>
    api
      .delete<
        ApiResponse<unknown>
      >(`/admin/reviews/${product_id}/${variant_id}/${user_id}/${review_id}`)
      .then((r) => r.data.data),

  // ── Roles ──
  getRoles: () =>
    api.get<ApiResponse<Role[]>>("/admin/roles").then((r) => r.data.data),

  createRole: (body: { name: string }) =>
    api
      .post<ApiResponse<{ role_id: number }>>("/admin/roles", body)
      .then((r) => r.data.data),

  // ── Staff ──
  // assignable=true excludes the SYSTEM_STAFF_ID placeholder ("System")
  // — selecting it from the order-assign combobox would write staff_id
  // back to the exact value that means "unclaimed", making the assignment
  // silently no-op. General staff-management pages should call this
  // without the param, since an admin does need to see/manage that row.
  getStaffList: (opts?: { assignable?: boolean }) =>
    api
      .get<ApiResponse<Staff[]>>("/admin/staff", {
        params: opts?.assignable ? { assignable: "true" } : undefined,
      })
      .then((r) => r.data.data),

  createStaff: (body: CreateStaffBody) =>
    api
      .post<ApiResponse<{ staff_id: number }>>("/admin/staff", body)
      .then((r) => r.data.data),

  getStaff: (staff_id: number) =>
    api
      .get<ApiResponse<Staff>>(`/admin/staff/${staff_id}`)
      .then((r) => r.data.data),

  updateStaff: (
    staff_id: number,
    body: Pick<CreateStaffBody, "name" | "birth_date" | "start_time">,
  ) =>
    api
      .patch<ApiResponse<Staff>>(`/admin/staff/${staff_id}`, body)
      .then((r) => r.data.data),

  assignRole: (staff_id: number, role_id: number) =>
    api
      .post<ApiResponse<unknown>>(`/admin/staff/${staff_id}/roles`, { role_id })
      .then((r) => r.data.data),

  removeRole: (staff_id: number, role_id: number) =>
    api
      .delete<ApiResponse<unknown>>(`/admin/staff/${staff_id}/roles/${role_id}`)
      .then((r) => r.data.data),

  getStaffHistory: (staff_id: number) =>
    api
      .get<ApiResponse<StaffHistory[]>>(`/admin/staff/${staff_id}/history`)
      .then((r) => r.data.data),

  getStaffCurrentStore: (staff_id: number) =>
    api
      .get<ApiResponse<StaffHistory>>(`/admin/staff/${staff_id}/store`)
      .then((r) => r.data.data),

  // Closes open history row + inserts new one — server wraps in transaction
  transferStaff: (
    staff_id: number,
    body: { store_id: number; start_date?: string },
  ) =>
    api
      .post<ApiResponse<unknown>>(`/admin/staff/${staff_id}/transfer`, body)
      .then((r) => r.data.data),

  // ── Stores ──
  getStores: () =>
    api.get<ApiResponse<Store[]>>("/admin/stores").then((r) => r.data.data),

  createStore: (body: { name: string; address: string }) =>
    api
      .post<ApiResponse<{ store_id: number }>>("/admin/stores", body)
      .then((r) => r.data.data),

  getStore: (store_id: number) =>
    api
      .get<ApiResponse<Store>>(`/admin/stores/${store_id}`)
      .then((r) => r.data.data),

  updateStore: (store_id: number, body: { name?: string; address?: string }) =>
    api
      .patch<ApiResponse<Store>>(`/admin/stores/${store_id}`, body)
      .then((r) => r.data.data),

  setStoreActive: (store_id: number, is_active: boolean) =>
    api
      .patch(`/admin/stores/${store_id}/status`, { is_active })
      .then((r) => r.data),

  getStoreInventory: (store_id: number) =>
    api
      .get<
        ApiResponse<StoreInventoryRow[]>
      >(`/admin/stores/${store_id}/inventory`)
      .then((r) => r.data.data),

  getStoreStaff: (store_id: number) =>
    api
      .get<ApiResponse<Staff[]>>(`/admin/stores/${store_id}/staff`)
      .then((r) => r.data.data),

  // ── Suppliers ──
  getSuppliers: () =>
    api
      .get<ApiResponse<Supplier[]>>("/admin/suppliers")
      .then((r) => r.data.data),

  createSupplier: (body: { name: string }) =>
    api
      .post<ApiResponse<{ supplier_id: number }>>("/admin/suppliers", body)
      .then((r) => r.data.data),

  updateSupplier: (supplier_id: number, body: { name: string }) =>
    api
      .put<ApiResponse<unknown>>(`/admin/suppliers/${supplier_id}`, body)
      .then((r) => r.data.data),

  deleteSupplier: (supplier_id: number) =>
    api
      .delete<ApiResponse<unknown>>(`/admin/suppliers/${supplier_id}`)
      .then((r) => r.data.data),
};
