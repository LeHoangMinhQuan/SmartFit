import api from "@/lib/axios";
import type { Category, ProductSummary, PaginatedResponse } from "@/interfaces";

export const categoryService = {
  async getCategories(): Promise<Category[]> {
    const { data } = await api.get<{ data: Category[] }>("/categories");
    return data.data;
  },

  async getCategoryProducts(
    category_id: number,
    params: {
      page?: number;
      limit?: number;
      minPrice?: number;
      maxPrice?: number;
      sort?: string;
    } = {},
  ): Promise<PaginatedResponse<ProductSummary>> {
    const { data } = await api.get<{
      data: {
        product_id: number;
        name: string;
        description?: string;
        preview_image: string | null; // from findProductsByCategory: pi.s3_url as preview_image
        min_price: string | null; // Knex returns numeric aggregates as strings
        max_price: string | null;
      }[];
      meta: { total: number };
    }>(`/categories/${category_id}/products`, { params });

    // Map API shape → ProductSummary.
    // avg_rating is Option A: always null on list pages.
    // The category endpoint returns min_price/max_price aggregates — we use
    // min_price as the display price (lowest variant price in the category).
    const mapped: ProductSummary[] = data.data.map((item) => ({
      product_id: item.product_id,
      name: item.name,
      description: item.description,
      image: item.preview_image,
      price: item.min_price != null ? Number(item.min_price) : null,
      originalPrice: undefined, // discount info not returned by category endpoint
      discountActive: false, // same — not returned, safe default
      avg_rating: null, // Option A: not fetched on list pages
    }));

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    return {
      data: mapped,
      meta: {
        page,
        limit,
        total: data.meta.total,
        totalPages: Math.ceil(data.meta.total / limit),
      },
    };
  },

  async createCategory(body: {
    name: string;
    parent_id?: number | null;
  }): Promise<{ category_id: number }> {
    const { data } = await api.post<{ data: { category_id: number } }>(
      "/categories",
      body,
    );
    return data.data;
  },

  async updateCategory(
    category_id: number,
    body: { name?: string; parent_id?: number | null },
  ): Promise<void> {
    await api.put(`/categories/${category_id}`, body);
  },

  async deleteCategory(category_id: number): Promise<void> {
    await api.delete(`/categories/${category_id}`);
  },
};
