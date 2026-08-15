// Product Card Props
export interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  rating: number;
  imageUrl?: string;
}

// Button Props
export type ButtonVariant = "primary" | "secondary" | "default";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: ButtonVariant;
}

// Auth
export interface User {
  user_id: number;
  username: string;
  email: string;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  created_at: string;
}

// Auth state for Zustand store
export interface AuthUser {
  user_id: number;
  username: string;
  email: string;
  phone: string | null; // nullable (2026-08-01) — Google accounts have none at signup
  avatar_url?: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  hasHydrated: boolean;
  setAuth: (user: AuthUser) => void;
  clearAuth: () => void;
  setHasHydrated: (state: boolean) => void;
}

// Product
export interface Product {
  product_id: number;
  name: string; // VARCHAR(20)
  description: string; // VARCHAR(100)
  images: ProductImage[];
  variants: ProductVariant[];
  categories: Category[];
  // Used for real GHN shipping fee/service calculation instead of a
  // hardcoded placeholder parcel. Nullable — falls back to a placeholder
  // parcel per item when unset.
  weight_grams?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

export interface ProductSummary {
  product_id: number;
  name: string;
  description?: string;
  image: string | null; // first product_image.s3_url — null if no image
  price: number | null; // product_price.base_price — null if not yet priced
  originalPrice?: number; // base_price before discount, present when discountActive
  discountActive: boolean;
  avg_rating: number | null; // Option A: always null on list pages, only populated on detail page
}

export interface ProductVariant {
  product_id: number;
  variant_id: number;
  name: string; // VARCHAR(100)
  base_price: number; // from product_price
  attributes: ProductAttribute[];
  images: ProductImage[];
  discount?: Discount | null;
  stock?: number; // from store_product
}

export interface ProductImage {
  image_id: number;
  product_id: number;
  variant_id: number | null; // null = general/product-level image, not tied to a variant;
  s3_url: string;
}

export interface ProductAttribute {
  attribute_id: number;
  attribute_name: string; // from attribute.name
  value: string; // VARCHAR(20)
}

export interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedId: number | null;
  onSelect: (variant: ProductVariant) => void;
}

// Category
export interface Category {
  category_id: number;
  name: string;
  parent_id: number | null;
  children?: Category[];
  is_featured?: boolean;
  display_order?: number | null;
  image_url?: string | null;
}

// Discount (variant-level markdown)
export interface Discount {
  discount_id: number;
  voucher_code: string;
  voucher_type: string;
  voucher_value: number;
  start_date: string;
  end_date: string;
}

// Voucher (user checkout code)
export interface Voucher {
  voucher_id: number;
  code: string;
  description: string;
  type: "percent" | "fixed";
  value: number;
  max_discount: number;
  min_amount: number;
  start_date: string;
  end_date: string;
  usage_limit: number;
  usage_count: number;
}

// Cart
export interface CartItem {
  product_id: number;
  variant_id: number;
  user_id: number;
  cart_id: number;
  quantity: number;
  unit_price: number; // computed server-side — never compute on frontend
  subtotal: number; // computed server-side — never compute on frontend
  product_name?: string;
  variant_name?: string;
  image_url?: string;
}

// Order
export type OrderStatus =
  | "pending_payment"
  | "cod_confirmed"
  | "paid"
  | "preparing"
  | "shipping"
  | "delivered"
  | "cancelled"
  | "payment_failed"
  | "refund_requested"
  | "refunded";

export interface Order {
  order_id: number;
  user_id: number;
  // Only present on the staff-facing GET /admin/orders list (order.model.ts's
  // findAllOrders LEFT JOINs USER for this) — undefined on the
  // customer-facing endpoints, which return items scoped to the
  // authenticated user and have no reason to look their own name up.
  username?: string | null;
  staff_id: number;
  payment_method_id: number;
  // BUG FIX: the API (findOrderByIdAndUser, order.model.ts) already joins
  // and returns this — it just wasn't declared here, which is how
  // order-detail-page.tsx ended up inferring "is this COD" from
  // order.status instead of this field directly (see that page's fix).
  payment_method_name: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string | null;
  total_amount: number;
  shipping_address: string; // VARCHAR(70) denormalized
  shipping_order_id: number | null;
  items: OrderItem[];
  shipping?: ShippingOrder;
  // Only present (staff-facing GET /admin/orders/:order_id) once the order
  // has reached refund_requested/refunded — the most recent refund attempt,
  // so staff can see why a previous try failed instead of just seeing the
  // order stuck at refund_requested with no context.
  latest_refund?: {
    refund_id: number;
    status: "pending" | "success" | "failed";
    amount: number;
    reason: string | null;
    vnpay_response_code: string | null;
    created_at: string;
  } | null;
  // STAFF-ROLE FEATURE: who's handling fulfillment. Present on both the
  // staff list (findAllOrders) and detail (adminGetOrderDetail) endpoints.
  // is_unclaimed is true while staff_id still holds the SYSTEM_STAFF_ID
  // placeholder set at checkout — the first staff/admin to advance the
  // order's status claims it (see order.service.ts's adminUpdateStatus),
  // after which only that staff (or any admin) can change it further.
  handler_name?: string | null;
  is_unclaimed?: boolean;
}

export interface OrderItem {
  order_id: number;
  product_id: number;
  variant_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  // BUG FIX: order.model.ts's findOrderItems already JOINs product +
  // product_variant + product_image and SELECTs these — they just
  // weren't declared here, which is how the staff order-detail page
  // ended up rendering "Product #6 / Variant #1" instead of the actual
  // names it already had in hand. Not present on any endpoint besides
  // order detail (findOrderItems is only called from there).
  product_name: string;
  variant_name: string;
  image_url: string | null;
}

// Payment
export interface PaymentTransaction {
  transaction_id: number;
  order_id: number;
  vnpay_txn_ref: string;
  vnpay_amount: number;
  vnpay_bank_code: string;
  vnpay_pay_date: string;
  vnpay_transaction_no: string;
  vnpay_response_code: string;
  status: "pending" | "success" | "failed";
  created_at: string;
}

// Suppliers
export interface Supplier {
  supplier_id: number;
  name: string;
}

// Shipping
export type GhnRequiredNote =
  | "CHOTHUHANG"
  | "CHOXEMHANGKHONGTHU"
  | "KHONGCHOXEMHANG";

export interface ShippingOrder {
  shipping_order_id: number;
  order_id: number;
  service_id: number | null;
  tracking_code: string;
  shipping_fee: number;
  // Which "buyer can inspect goods" option this shipment was created (or
  // last updated) with. Nullable — shipments created before this column
  // existed have no value here.
  required_note: GhnRequiredNote | null;
  created_at: string;
}

export interface ShippingLog {
  shipping_order_id: number;
  status: string; // VARCHAR(10) — mapped from GHN
  updated_date: string;
}

export interface Province {
  province_id: number;
  province_name: string;
  province_code: string;
  status: number;
}

export interface District {
  district_id: number;
  province_id: number;
  district_name: string;
  district_code: string;
  supporttype: number; // 0=locked, 3=full service
  status: number;
}

export interface Ward {
  ward_id: number;
  district_id: number;
  ward_name: string;
  canupdatecod: boolean;
  supporttype: number;
  status: number;
}

// Address
export interface Address {
  address_id: number;
  address_line: string; // VARCHAR(20)
  province_id: number;
  district_id: number;
  ward_id: number;
  // Delivery contact number — required for every address.
  phone: string;
}

export interface UserAddress extends Address {
  is_default: boolean;
  label: string; // VARCHAR(20)
}

// Review
// ReviewCardProps
export interface ReviewReply {
  reply_id: number;
  review_id: number;
  user_id: number | null;
  staff_id: number | null;
  comment: string;
  created_at: string;
  username?: string | null; // set when user_id is present
  avatar_url?: string | null;
  staff_name?: string | null; // set when staff_id is present
}

export interface Review {
  product_id: number;
  variant_id: number;
  user_id: number;
  review_id: number;
  rating: number;
  comment: string;
  username: string;
  avatar_url?: string;
  replies?: ReviewReply[];
}

// Wishlist
export interface WishlistItem {
  user_id?: number;
  product_id: number;
  variant_id: number;
  created_at: string;
  // Present on GET /users/me/wishlist (joined with product/variant/price/image).
  // Not present on the POST /users/me/wishlist response, which only
  // returns a confirmation message — see wishlist.service.ts.
  product_name?: string;
  variant_name?: string;
  base_price?: string | null;
  image_url?: string | null;
  // Added alongside the price-display consistency pass — see
  // wishlist.model.ts's findActiveWishlist. Same shape as ProductVariant's
  // `discount` field, reused by PriceDisplay.
  discount?: Discount | null;
}

// Try-On
export type TryOnStatus = "processing" | "ready" | "failed";

// Cloth-type mirrors the backend's clothTypeEnum (tryon.schema.ts), which
// maps 1:1 to Leffa's garment-type labels on the Kaggle side: 'upper' ->
// 'upper_body', 'lower' -> 'lower_body', 'overall' -> 'dresses'.
export type ClothType = "upper" | "lower" | "overall";

export type TryOnFailureReason =
  | "endpoint_not_registered"
  | "endpoint_offline"
  | "inference_error"
  | "timeout";

// DB row shape (tryon_session table). NOT what GET /tryon/preview/:id
// returns — see TryOnPollResult below for that.
export interface TryOnSession {
  session_id: number;
  user_id: number;
  product_id: number;
  variant_id: number;
  user_photo_url: string;
  result_url: string | null;
  status: TryOnStatus;
  created_at: string;
  expires_at: string;
}

// What GET /tryon/preview/:session_id actually returns — a discriminated
// union, per swagger's TryonPollResult schema. 'processing' has no other
// fields; 'ready' adds result_url/expires_at; 'failed' adds reason. Do NOT
// reuse TryOnSession here — that's the DB row shape and doesn't match
// (no session_id/user_id/etc. come back from this endpoint).
export type TryOnPollResult =
  | { status: "processing" }
  | { status: "ready"; result_url: string; expires_at: string }
  | { status: "failed"; reason: TryOnFailureReason };

// Staff
export interface Staff {
  staff_id: number;
  name: string;
  birth_date: string | null;
  start_time: string | null;
  // Only present on GET /admin/staff/:staff_id (StaffService.getStaff
  // joins role_assigment -> role and spreads it onto the staff row).
  // Absent from the list endpoint (GET /admin/staff).
  roles?: Role[];
}

export interface Role {
  role_id: number;
  name: string;
}

export interface Store {
  store_id: number;
  name: string;
  address: string;
  is_active: boolean;
}

// Pagination meta (matches API response shape)
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ── Chat (AI Shopping Assistant) ────────────────────────────────────────────
// Mirrors backend services/retrieval.service.ts's ProductCard and
// models/chat-session.model.ts's ChatMessageRow. Duplicated by hand rather
// than shared across the fe/be boundary (separate packages) — same as
// every other API-shape type in this file.

export interface ChatProductCardData {
  product_id: number;
  variant_id: number | null;
  name: string;
  price: number | null;
  // Added alongside the price-display consistency pass — see
  // retrieval.service.ts's ProductCard. Same shape as Discount elsewhere.
  discount?: Discount | null;
  image_url: string | null;
  url: string;
}

export interface ChatAddToCartOutput {
  cart_url: string;
}

// Mirrors backend services/chat.service.ts's prepare_checkout tool output.
export interface ChatPrepareCheckoutOutput {
  checkout_url: string;
  warnings: string[];
}

export interface ChatToolError {
  error: string;
}

// Attached to the assistant message via the backend's messageMetadata
// callback (chat.controller.ts) — read in ChatPanel's useChat onFinish.
export interface ChatMessageMetadata {
  session_id: number;
}

export interface ChatMessageHistoryItem {
  message_id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ChatSessionHistoryResponse {
  session_id: number;
  messages: ChatMessageHistoryItem[];
}
