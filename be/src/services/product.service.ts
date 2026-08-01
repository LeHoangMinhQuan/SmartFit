import { ApiError } from "../utils/ApiError.js";
import * as ProductModel from "../models/product/product.model.js";
import * as PriceModel from "../models/product/product_price.model.js";
import * as AttributeModel from "../models/attribute.model.js";
import * as CategoryModel from "../models/category.model.js";
import * as ReviewModel from "../models/review.model.js";
import { Category } from "../models/category.model.js";
import * as EmbeddingService from "./embedding.service.js";

/**
 * NOTE (2026-08-01): embedding.service.ts's own doc comment has claimed
 * since Phase 3 that upsertProductEmbedding is "hooked into
 * product.service.ts's create/update paths (product, variant, attribute,
 * category, price)" — but no such hook ever actually existed anywhere in
 * this file. product_embedding was therefore only ever populated by
 * explicitly calling POST /api/admin/chat/reindex, which is why
 * search_products returned zero results for every query regardless of
 * model choice: the table was empty (or missing every product added/
 * edited since the last manual reindex).
 *
 * Fails safe like the VNPay reconciliation fix — a re-embed failure
 * (budget exhausted, Gemini down, etc.) must never fail the product
 * mutation the staff member is actually trying to do. Worst case, that
 * one product's embedding goes stale until the next manual reindex,
 * exactly like before this fix existed.
 */
async function reembedProductSafely(product_id: number): Promise<void> {
  try {
    await EmbeddingService.upsertProductEmbedding(product_id);
  } catch (err) {
    console.error(
      `[product.service] Failed to re-embed product ${product_id} after a catalog edit — it will show stale/missing in chatbot search until the next POST /api/admin/chat/reindex:`,
      err,
    );
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function listProducts(
  filters: Parameters<typeof ProductModel.findAllProducts>[0],
) {
  return ProductModel.findAllProducts(filters);
}

export async function searchProducts(
  query: string,
  page?: number,
  limit?: number,
) {
  return ProductModel.searchProducts(query, page, limit);
}

export async function getTopSellingProducts(limit?: number) {
  return ProductModel.findTopSellingProducts(limit);
}

export async function getProduct(product_id: number) {
  const product = await ProductModel.findProductById(product_id);
  if (!product) throw new ApiError(404, "Product not found");

  const [variants, images, categories] = await Promise.all([
    ProductModel.findVariantsByProduct(product_id),
    ProductModel.findImagesByProduct(product_id),
    ProductModel.findCategoriesByProduct(product_id),
  ]);

  return { ...product, variants, images, categories };
}

export async function createProduct(data: {
  name: string;
  description: string;
  category_ids?: number[];
  weight_grams?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
}) {
  const product_id = await ProductModel.createProduct({
    name: data.name,
    description: data.description,
    weight_grams: data.weight_grams ?? null,
    length_cm: data.length_cm ?? null,
    width_cm: data.width_cm ?? null,
    height_cm: data.height_cm ?? null,
  });
  if (data.category_ids?.length) {
    await ProductModel.setProductCategories(product_id, data.category_ids);
  }
  await reembedProductSafely(product_id);
  return { product_id };
}

export async function updateProduct(
  product_id: number,
  data: {
    name?: string;
    description?: string;
    category_ids?: number[];
    weight_grams?: number;
    length_cm?: number;
    width_cm?: number;
    height_cm?: number;
  },
) {
  const product = await ProductModel.findProductById(product_id);
  if (!product) throw new ApiError(404, "Product not found");

  const update: any = {};
  if (data.name) update.name = data.name;
  if (data.description) update.description = data.description;
  if (data.weight_grams !== undefined) update.weight_grams = data.weight_grams;
  if (data.length_cm !== undefined) update.length_cm = data.length_cm;
  if (data.width_cm !== undefined) update.width_cm = data.width_cm;
  if (data.height_cm !== undefined) update.height_cm = data.height_cm;
  if (Object.keys(update).length)
    await ProductModel.updateProduct(product_id, update);
  if (data.category_ids)
    await ProductModel.setProductCategories(product_id, data.category_ids);

  await reembedProductSafely(product_id);
  return ProductModel.findProductById(product_id);
}

export async function deleteProduct(product_id: number) {
  const product = await ProductModel.findProductById(product_id);
  if (!product) throw new ApiError(404, "Product not found");
  return ProductModel.deleteProduct(product_id);
}

// ─── Variants ─────────────────────────────────────────────────────────────────

export async function getVariants(product_id: number) {
  const product = await ProductModel.findProductById(product_id);
  if (!product) throw new ApiError(404, "Product not found");
  return ProductModel.findVariantsByProduct(product_id);
}

export async function createVariant(
  product_id: number,
  data: { variant_id: number; name: string },
) {
  const product = await ProductModel.findProductById(product_id);
  if (!product) throw new ApiError(404, "Product not found");

  const existing = await ProductModel.findVariant(product_id, data.variant_id);
  if (existing)
    throw new ApiError(
      409,
      `Variant ${data.variant_id} already exists for this product`,
    );

  await ProductModel.createVariant({
    product_id,
    variant_id: data.variant_id,
    name: data.name,
  });
  return { product_id, variant_id: data.variant_id };
}

export async function updateVariant(
  product_id: number,
  variant_id: number,
  data: { name: string },
) {
  const variant = await ProductModel.findVariant(product_id, variant_id);
  if (!variant) throw new ApiError(404, "Variant not found");
  await ProductModel.updateVariant(product_id, variant_id, data);
}

export async function deleteVariant(product_id: number, variant_id: number) {
  const variant = await ProductModel.findVariant(product_id, variant_id);
  if (!variant) throw new ApiError(404, "Variant not found");
  await ProductModel.deleteVariant(product_id, variant_id);
}

export async function upsertVariantPrice(
  product_id: number,
  variant_id: number,
  data: { base_price: number; start_date: string; end_date: string },
) {
  const variant = await ProductModel.findVariant(product_id, variant_id);
  if (!variant) throw new ApiError(404, "Variant not found");

  if (new Date(data.start_date) >= new Date(data.end_date)) {
    throw new ApiError(400, "start_date must be before end_date");
  }

  await PriceModel.upsertProductPrice({ product_id, variant_id, ...data });
  await reembedProductSafely(product_id);
}

// ─── Attributes ───────────────────────────────────────────────────────────────

export async function listAttributes() {
  return AttributeModel.findAllAttributes();
}

export async function createAttribute(name: string) {
  const existing = await AttributeModel.findAttributeByName(name);
  if (existing) throw new ApiError(409, `Attribute "${name}" already exists`);
  const attribute_id = await AttributeModel.createAttribute(name);
  return { attribute_id };
}

export async function attachAttribute(
  product_id: number,
  variant_id: number,
  data: { attribute_id: number; value: string },
) {
  const existing = await AttributeModel.findProductAttribute(
    data.attribute_id,
    product_id,
    variant_id,
  );
  if (existing)
    throw new ApiError(
      409,
      "Attribute already attached to this variant — use PATCH to update the value",
    );

  const attrExists = await AttributeModel.findAttributeById(data.attribute_id);
  if (!attrExists) throw new ApiError(404, "Attribute not found in catalog");

  await AttributeModel.attachAttributeToVariant({
    ...data,
    product_id,
    variant_id,
  });
  await reembedProductSafely(product_id);
}

export async function updateAttributeValue(
  product_id: number,
  variant_id: number,
  attribute_id: number,
  value: string,
) {
  const existing = await AttributeModel.findProductAttribute(
    attribute_id,
    product_id,
    variant_id,
  );
  if (!existing) throw new ApiError(404, "Attribute not found on this variant");
  await AttributeModel.updateAttributeValue(
    attribute_id,
    product_id,
    variant_id,
    value,
  );
  await reembedProductSafely(product_id);
}

export async function removeAttribute(
  product_id: number,
  variant_id: number,
  attribute_id: number,
) {
  const existing = await AttributeModel.findProductAttribute(
    attribute_id,
    product_id,
    variant_id,
  );
  if (!existing) throw new ApiError(404, "Attribute not found on this variant");
  await AttributeModel.deleteAttributeFromVariant(
    attribute_id,
    product_id,
    variant_id,
  );
  await reembedProductSafely(product_id);
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategoryTree() {
  const rows = await CategoryModel.findAllCategories();
  return CategoryModel.buildCategoryTree(rows);
}

export async function getProductsByCategory(
  category_id: number,
  page?: number,
  limit?: number,
  minPrice?: number,
  maxPrice?: number,
  sort?: string,
) {
  const cat = await CategoryModel.findCategoryById(category_id);
  if (!cat) throw new ApiError(404, "Category not found");
  return ProductModel.findProductsByCategory(
    category_id,
    page,
    limit,
    minPrice,
    maxPrice,
    sort,
  );
}

export async function createCategory(data: Category) {
  try {
    const category_id = await CategoryModel.createCategory(data);
    return { category_id };
  } catch (err: any) {
    if (err.code === "23505") {
      throw new ApiError(409, "A category with this name already exists");
    }
    throw err;
  }
}

export async function updateCategory(
  category_id: number,
  data: Partial<Category>,
) {
  try {
    return await CategoryModel.updateCategory(category_id, data);
  } catch (err: any) {
    if (err.code === "23505") {
      throw new ApiError(409, "A category with this name already exists");
    }
    throw err;
  }
}

export async function getFeaturedCategories() {
  return CategoryModel.findFeaturedCategories();
}

export async function setCategoryImage(category_id: number, image_url: string) {
  return CategoryModel.setCategoryImage(category_id, image_url);
}

export async function deleteCategory(category_id: number) {
  const cat = await CategoryModel.findCategoryById(category_id);
  if (!cat) throw new ApiError(404, "Category not found");
  await CategoryModel.deleteCategory(category_id);
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export async function getProductReviews(
  product_id: number,
  page?: number,
  limit?: number,
) {
  const product = await ProductModel.findProductById(product_id);
  if (!product) throw new ApiError(404, "Product not found");
  return ReviewModel.findReviewsByProduct(product_id, page, limit);
}

export async function submitReview(
  product_id: number,
  variant_id: number,
  user_id: number,
  data: { rating: number; comment: string },
) {
  const variant = await ProductModel.findVariant(product_id, variant_id);
  if (!variant) throw new ApiError(404, "Product variant not found");

  const review_id = await ReviewModel.createReview({
    product_id,
    variant_id,
    user_id,
    ...data,
  });
  return { review_id };
}

// ─── Images ──────────────────────────────────────────────────────────────────

export async function addProductImage(
  product_id: number,
  variant_id: number | undefined,
  s3_url: string,
) {
  const product = await ProductModel.findProductById(product_id);
  if (!product) throw new ApiError(404, "Product not found");
  const image_id = await ProductModel.insertProductImage({
    product_id,
    variant_id,
    s3_url,
  });
  return { image_id };
}
