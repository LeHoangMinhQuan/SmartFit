import api from "../../lib/axios";
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

// ─── Dashboard ───────────────────────────────────────────────────────────────

interface DashboardStats {
  total_revenue: number;
  orders_by_status: Record<OrderStatus, number>;
  top_products: Array<{ product_id: number; name: string; sold: number }>;
  new_users: number;
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
  password_hash: string;
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
    api.get<DashboardStats>("/api/admin/dashboard").then((r) => r.data),

  // ── Products ──
  createProduct: (body: CreateProductBody) =>
    api.post<{ product_id: number }>("/api/products", body).then((r) => r.data),

  updateProduct: (product_id: number, body: Partial<CreateProductBody>) =>
    api.patch(`/api/products/${product_id}`, body).then((r) => r.data),

  deleteProduct: (product_id: number) =>
    api.delete(`/api/products/${product_id}`).then((r) => r.data),

  // Images — multipart, up to 10 files, 5 MB each, JPEG/PNG/WEBP
  uploadImages: (product_id: number, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("images", f));
    return api
      .post<{ image_ids: number[] }>(
        `/api/products/${product_id}/images`,
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      )
      .then((r) => r.data);
  },

  // ── Variants ──
  createVariant: (product_id: number, body: CreateVariantBody) =>
    api
      .post<ProductVariant>(`/api/products/${product_id}/variants`, body)
      .then((r) => r.data),

  updateVariant: (
    product_id: number,
    variant_id: number,
    body: Partial<CreateVariantBody>,
  ) =>
    api
      .put(`/api/products/${product_id}/variants/${variant_id}`, body)
      .then((r) => r.data),

  deleteVariant: (product_id: number, variant_id: number) =>
    api
      .delete(`/api/products/${product_id}/variants/${variant_id}`)
      .then((r) => r.data),

  // One active price row per variant at any time
  upsertPrice: (product_id: number, variant_id: number, body: PriceBody) =>
    api
      .post(`/api/products/${product_id}/variants/${variant_id}/price`, body)
      .then((r) => r.data),

  // ── Attributes ──
  getAttributes: () =>
    api.get<Attribute[]>("/api/attributes").then((r) => r.data),

  createAttribute: (body: { name: string }) =>
    api
      .post<{ attribute_id: number }>("/api/attributes", body)
      .then((r) => r.data),

  // product_attribute PK is (attribute_id, product_id, variant_id) — a given
  // attribute type can only be attached once per variant. Server returns 409
  // if it already exists; use updateAttributeValue instead.
  assignAttribute: (
    product_id: number,
    variant_id: number,
    body: AttributeAssignBody,
  ) =>
    api
      .post(
        `/api/products/${product_id}/variants/${variant_id}/attributes`,
        body,
      )
      .then((r) => r.data),

  updateAttributeValue: (
    product_id: number,
    variant_id: number,
    attribute_id: number,
    value: string,
  ) =>
    api
      .patch(
        `/api/products/${product_id}/variants/${variant_id}/attributes/${attribute_id}`,
        { value },
      )
      .then((r) => r.data),

  removeAttribute: (
    product_id: number,
    variant_id: number,
    attribute_id: number,
  ) =>
    api
      .delete(
        `/api/products/${product_id}/variants/${variant_id}/attributes/${attribute_id}`,
      )
      .then((r) => r.data),

  // ── Categories ──
  createCategory: (body: { name: string; parent_id?: number }) =>
    api
      .post<{ category_id: number }>("/api/categories", body)
      .then((r) => r.data),

  updateCategory: (
    category_id: number,
    body: { name?: string; parent_id?: number | null },
  ) => api.put(`/api/categories/${category_id}`, body).then((r) => r.data),

  deleteCategory: (category_id: number) =>
    api.delete(`/api/categories/${category_id}`).then((r) => r.data),

  // ── Orders ──
  getAllOrders: (params?: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    user_id?: number;
    created_at?: string;
  }) =>
    api
      .get<PaginatedResponse<Order>>("/api/admin/orders", { params })
      .then((r) => r.data),

  updateOrderStatus: (order_id: number, status: OrderStatus) =>
    api
      .patch(`/api/admin/orders/${order_id}/status`, { status })
      .then((r) => r.data),

  // ── Users ──
  getAllUsers: (params?: { page?: number; limit?: number }) =>
    api
      .get<PaginatedResponse<User>>("/api/admin/users", { params })
      .then((r) => r.data),

  getUser: (user_id: number) =>
    api.get<User>(`/api/admin/users/${user_id}`).then((r) => r.data),

  // ── Reviews ──
  getAllReviews: () => api.get("/api/admin/reviews").then((r) => r.data),

  deleteReview: (
    product_id: number,
    variant_id: number,
    user_id: number,
    review_id: number,
  ) =>
    api
      .delete(
        `/api/admin/reviews/${product_id}/${variant_id}/${user_id}/${review_id}`,
      )
      .then((r) => r.data),

  // ── Roles ──
  getRoles: () => api.get<Role[]>("/api/admin/roles").then((r) => r.data),

  createRole: (body: { name: string }) =>
    api.post<{ role_id: number }>("/api/admin/roles", body).then((r) => r.data),

  // ── Staff ──
  getStaffList: () => api.get<Staff[]>("/api/admin/staff").then((r) => r.data),

  createStaff: (body: CreateStaffBody) =>
    api
      .post<{ staff_id: number }>("/api/admin/staff", body)
      .then((r) => r.data),

  getStaff: (staff_id: number) =>
    api.get<Staff>(`/api/admin/staff/${staff_id}`).then((r) => r.data),

  updateStaff: (
    staff_id: number,
    body: Pick<CreateStaffBody, "name" | "birth_date" | "start_time">,
  ) => api.patch(`/api/admin/staff/${staff_id}`, body).then((r) => r.data),

  assignRole: (staff_id: number, role_id: number) =>
    api
      .post(`/api/admin/staff/${staff_id}/roles`, { role_id })
      .then((r) => r.data),

  removeRole: (staff_id: number, role_id: number) =>
    api
      .delete(`/api/admin/staff/${staff_id}/roles/${role_id}`)
      .then((r) => r.data),

  getStaffHistory: (staff_id: number) =>
    api
      .get<StaffHistory[]>(`/api/admin/staff/${staff_id}/history`)
      .then((r) => r.data),

  getStaffCurrentStore: (staff_id: number) =>
    api
      .get<StaffHistory>(`/api/admin/staff/${staff_id}/store`)
      .then((r) => r.data),

  // Closes open history row + inserts new one — server wraps in transaction
  transferStaff: (
    staff_id: number,
    body: { store_id: number; start_date?: string },
  ) =>
    api.post(`/api/admin/staff/${staff_id}/transfer`, body).then((r) => r.data),

  // ── Stores ──
  getStores: () => api.get<Store[]>("/api/admin/stores").then((r) => r.data),

  createStore: (body: { name: string; address: string }) =>
    api
      .post<{ store_id: number }>("/api/admin/stores", body)
      .then((r) => r.data),

  getStore: (store_id: number) =>
    api.get<Store>(`/api/admin/stores/${store_id}`).then((r) => r.data),

  updateStore: (store_id: number, body: { name?: string; address?: string }) =>
    api.patch(`/api/admin/stores/${store_id}`, body).then((r) => r.data),

  getStoreInventory: (store_id: number) =>
    api
      .get<StoreInventoryRow[]>(`/api/admin/stores/${store_id}/inventory`)
      .then((r) => r.data),

  getStoreStaff: (store_id: number) =>
    api.get<Staff[]>(`/api/admin/stores/${store_id}/staff`).then((r) => r.data),

  // ── Suppliers ──
  getSuppliers: () =>
    api.get<Supplier[]>("/api/admin/suppliers").then((r) => r.data),

  createSupplier: (body: { name: string }) =>
    api
      .post<{ supplier_id: number }>("/api/admin/suppliers", body)
      .then((r) => r.data),

  updateSupplier: (supplier_id: number, body: { name: string }) =>
    api.put(`/api/admin/suppliers/${supplier_id}`, body).then((r) => r.data),

  deleteSupplier: (supplier_id: number) =>
    api.delete(`/api/admin/suppliers/${supplier_id}`).then((r) => r.data),
};
