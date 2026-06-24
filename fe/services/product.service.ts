import api from "../lib/axios";
import type {
  PaginatedResponse,
  Product,
  ProductVariant,
  Review,
} from "../interfaces";

export const productService = {
  getProducts: (params?: Record<string, unknown>) =>
    api
      .get<PaginatedResponse<Product>>("/api/products", { params })
      .then((r) => r.data),

  searchProducts: (q: string, params?: Record<string, unknown>) =>
    api
      .get<
        PaginatedResponse<Product>
      >("/api/products/search", { params: { q, ...params } })
      .then((r) => r.data),

  getProduct: (id: number) =>
    api.get<Product>(`/api/products/${id}`).then((r) => r.data),

  getVariants: (id: number) =>
    api
      .get<ProductVariant[]>(`/api/products/${id}/variants`)
      .then((r) => r.data),

  getReviews: (id: number) =>
    api.get<Review[]>(`/api/products/${id}/reviews`).then((r) => r.data),

  submitReview: (
    product_id: number,
    variant_id: number,
    body: { rating: number; comment: string },
  ) =>
    api
      .post(`/api/products/${product_id}/variants/${variant_id}/reviews`, body)
      .then((r) => r.data),

  editReview: (
    product_id: number,
    variant_id: number,
    review_id: number,
    body: Partial<{ rating: number; comment: string }>,
  ) =>
    api
      .patch(`/api/reviews/${product_id}/${variant_id}/${review_id}`, body)
      .then((r) => r.data),

  deleteReview: (product_id: number, variant_id: number, review_id: number) =>
    api
      .delete(`/api/reviews/${product_id}/${variant_id}/${review_id}`)
      .then((r) => r.data),
};
