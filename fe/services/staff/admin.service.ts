import api from "../../lib/staffAxios";
import type {
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

interface DashboardStats {
  total_revenue: number;
  orders_by_status: Record<OrderStatus, number>;
  top_products: Array<{ product_id: number; name: string; sold: number }>;
  new_users_last_30d: number;
}

// ─── Products ─────────────────────────────────────────────────────────────────

interface CreateProductBody {
  name: string; // VARCHAR(20)
  description: string; // VARCHAR(100)
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
  getDashboard: () =>
    api
      .get<ApiResponse<DashboardStats>>("/admin/dashboard")
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
  createCategory: (body: { name: string; parent_id?: number }) =>
    api
      .post<ApiResponse<{ category_id: number }>>("/categories", body)
      .then((r) => r.data.data),

  updateCategory: (
    category_id: number,
    body: { name?: string; parent_id?: number | null },
  ) =>
    api
      .put<ApiResponse<unknown>>(`/categories/${category_id}`, body)
      .then((r) => r.data.data),

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
    created_at?: string;
  }) =>
    api
      .get<PaginatedResponse<Order>>("/admin/orders", { params })
      .then((r) => r.data),

  updateOrderStatus: (order_id: number, status: OrderStatus) =>
    api
      .patch<
        ApiResponse<unknown>
      >(`/admin/orders/${order_id}/status`, { status })
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
  getStaffList: () =>
    api.get<ApiResponse<Staff[]>>("/admin/staff").then((r) => r.data),

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
