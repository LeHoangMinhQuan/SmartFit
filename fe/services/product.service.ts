import api from "@/lib/axios";
import type {
  Product,
  ProductSummary,
  ProductVariant,
  Review,
  PaginatedResponse,
} from "@/interfaces";

// ─── Raw API shapes (internal — not exported) ─────────────────────────────────

interface RawProductListItem {
  product_id: number;
  name: string;
  description?: string;
  preview_image: string | null; // pi.s3_url as preview_image
  min_price: string | null; // Knex numeric aggregate → string
  max_price: string | null;
}

/**
 * Map a raw product list row → ProductSummary.
 * Option A: avg_rating is always null on list pages.
 */
function toSummary(item: RawProductListItem): ProductSummary {
  return {
    product_id: item.product_id,
    name: item.name,
    description: item.description,
    image: item.preview_image,
    price: item.min_price != null ? Number(item.min_price) : null,
    originalPrice: undefined, // not returned by list endpoints
    discountActive: false, // not returned by list endpoints
    avg_rating: null, // Option A: only populated on product detail page
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const productService = {
  async getProducts(
    params: {
      page?: number;
      limit?: number;
      sort?: string;
      category_id?: number;
      minPrice?: number;
      maxPrice?: number;
      attribute_id?: number;
    } = {},
  ): Promise<PaginatedResponse<ProductSummary>> {
    const { data } = await api.get<{
      data: RawProductListItem[];
      meta: { page: number; limit: number; total: number };
    }>("/products", { params });

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    return {
      data: data.data.map(toSummary),
      meta: {
        page: data.meta.page,
        limit: data.meta.limit,
        total: data.meta.total,
        totalPages: Math.ceil(data.meta.total / limit),
      },
    };
  },

  async searchProducts(
    q: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResponse<ProductSummary>> {
    const { data } = await api.get<{
      data: RawProductListItem[];
      meta: { page: number; limit: number; total: number };
    }>("/products/search", { params: { q, ...params } });

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    return {
      data: data.data.map(toSummary),
      meta: {
        page: data.meta.page ?? page,
        limit: data.meta.limit ?? limit,
        total: data.meta.total,
        totalPages: Math.ceil(data.meta.total / limit),
      },
    };
  },

  async getProduct(id: number): Promise<Product> {
    const { data } = await api.get<{ data: Product }>(`/products/${id}`);
    return data.data;
  },

  async getVariants(id: number): Promise<ProductVariant[]> {
    const { data } = await api.get<{ data: ProductVariant[] }>(
      `/products/${id}/variants`,
    );
    return data.data;
  },

  async getReviews(
    id: number,
    params: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResponse<Review> & { avg_rating: number }> {
    const { data } = await api.get<{
      data: Review[];
      meta: { total: number; avg_rating: number };
    }>(`/products/${id}/reviews`, { params });

    return {
      data: data.data,
      meta: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        total: data.meta.total,
        totalPages: Math.ceil(data.meta.total / (params.limit ?? 20)),
      },
      avg_rating: data.meta.avg_rating ?? 0,
    };
  },

  async submitReview(
    product_id: number,
    variant_id: number,
    body: { rating: number; comment: string },
  ): Promise<{ review_id: number }> {
    const { data } = await api.post<{ data: { review_id: number } }>(
      `/products/${product_id}/variants/${variant_id}/reviews`,
      body,
    );
    return data.data;
  },

  async editReview(
    product_id: number,
    variant_id: number,
    review_id: number,
    body: { rating?: number; comment?: string },
  ): Promise<void> {
    await api.patch(`/reviews/${product_id}/${variant_id}/${review_id}`, body);
  },

  async deleteReview(
    product_id: number,
    variant_id: number,
    review_id: number,
  ): Promise<void> {
    await api.delete(`/reviews/${product_id}/${variant_id}/${review_id}`);
  },
};
