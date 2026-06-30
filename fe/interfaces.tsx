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
  // onClick is inherited from ButtonHTMLAttributes<HTMLButtonElement> with the
  // correct signature: React.MouseEventHandler<HTMLButtonElement>.
  // Do NOT redeclare it as () => void — that drops the event parameter and
  // causes "not assignable" errors when the event is passed by React internally.
}

// Auth
export interface User {
  user_id: number;
  username: string;
  email: string;
  phone: string | null;       // CHAR(10)
  address: string | null;     // VARCHAR(70)
  avatar_url: string | null;
  created_at: string;
}

// Product
export interface Product {
  product_id: number;
  name: string;               // VARCHAR(20)
  description: string;        // VARCHAR(100)
  images: ProductImage[];
  variants: ProductVariant[];
  categories: Category[];
}

export interface ProductSummary {
  product_id: number;
  name: string;
  description?: string;
  image: string | null;
  price: number | null;
  discountActive: boolean;
}

export interface ProductVariant {
  product_id: number;
  variant_id: number;
  name: string;               // VARCHAR(100)
  base_price: number;         // from product_price
  attributes: ProductAttribute[];
  images: ProductImage[];
  discount?: Discount | null;
  stock?: number;             // from store_product
}

export interface ProductImage {
  image_id: number;
  product_id: number;
  variant_id: number;
  s3_url: string;
}

export interface ProductAttribute {
  attribute_id: number;
  attribute_name: string;     // from attribute.name
  value: string;              // VARCHAR(20)
}

export interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedId: number | null;
  onSelect: (variant: ProductVariant) => void;
}

// Category
export interface Category {
  category_id: number;
  name: string;               // VARCHAR(30)
  parent_id: number | null;
  children?: Category[];
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
  type: 'percent' | 'fixed';
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
  unit_price: number;         // computed server-side
  subtotal: number;           // computed server-side
  // enriched by frontend:
  product_name?: string;
  variant_name?: string;
  image_url?: string;
}

// Order
export type OrderStatus =
  | 'pending_payment' | 'paid' | 'preparing' | 'shipping'
  | 'delivered' | 'cancelled' | 'payment_failed'
  | 'refund_requested' | 'refunded';

export interface Order {
  order_id: number;
  user_id: number;
  staff_id: number;
  payment_method_id: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string | null;
  total_amount: number;
  shipping_address: string;   // VARCHAR(70) denormalized
  shipping_order_id: number | null;
  items: OrderItem[];
  shipping?: ShippingOrder;
}

export interface OrderItem {
  order_id: number;
  product_id: number;
  variant_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

// Payment
export interface PaymentTransaction {
  transaction_id: number;
  order_id: number;
  vnp_txn_ref: string;
  vnp_amount: number;
  vnp_bank_code: string;
  vnp_pay_date: string;
  vnp_transaction_no: string;
  vnp_response_code: string;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
}

// Shipping
export interface ShippingOrder {
  shipping_order_id: number;
  order_id: number;
  service_id: number | null;
  tracking_code: string;
  shipping_fee: number;
  created_at: string;
}

export interface ShippingLog {
  shipping_order_id: number;
  status: string;             // VARCHAR(10) — mapped from GHN
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
  supporttype: number;        // 0=locked, 3=full service
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
  address_line: string;       // VARCHAR(20)
  province_id: number;
  district_id: number;
  ward_id: number;
}

export interface UserAddress extends Address {
  is_default: boolean;
  label: string;              // VARCHAR(20)
}

// Review
export interface Review {
  product_id: number;
  variant_id: number;
  user_id: number;
  review_id: number;
  rating: number;             // 1–5
  comment: string;
}

// Wishlist
export interface WishlistItem {
  user_id: number;
  product_id: number;
  variant_id: number;
  created_at: string;
}

// Try-On
export type TryOnStatus = 'processing' | 'ready' | 'failed';

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

// Staff
export interface Staff {
  staff_id: number;
  name: string;
  birth_date: string | null;
  start_time: string | null;
}

export interface Role {
  role_id: number;
  name: string;
}

export interface Store {
  store_id: number;
  name: string;
  address: string;
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
