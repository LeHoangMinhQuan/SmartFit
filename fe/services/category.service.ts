import api from "../lib/axios";
import type { Category, PaginatedResponse, ProductSummary } from "../interfaces";

export const categoryService = {
  getCategories: () =>
    api.get<Category[]>("/api/categories").then((r) => r.data),

  getCategoryProducts: (
    category_id: number,
    params?: {
      page?: number;
      limit?: number;
      sort?: string;
      minPrice?: number;
      maxPrice?: number;
      attribute_id?: number;
    },
  ) =>
    api
      .get<
        PaginatedResponse<ProductSummary>
      >(`/api/categories/${category_id}/products`, { params })
      .then((r) => r.data),

  // Staff only
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
};
