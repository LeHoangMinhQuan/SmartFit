import { ApiError } from "../utils/ApiError.js";
import * as ProductModel from "../models/product/product.model.js";
import * as PriceModel from "../models/product/product_price.model.js";
import * as AttributeModel from "../models/attribute.model.js";
import * as CategoryModel from "../models/category.model.js";
import * as ReviewModel from "../models/review.model.js";

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

export async function getProduct(product_id: number) {
  const product = await ProductModel.findProductById(product_id);
  if (!product) throw new ApiError(404, "Product not found");

  const [variants, images] = await Promise.all([
    ProductModel.findVariantsByProduct(product_id),
    ProductModel.findImagesByProduct(product_id),
  ]);

  return { ...product, variants, images };
}

export async function createProduct(data: {
  name: string;
  description: string;
  category_ids?: number[];
}) {
  const product_id = await ProductModel.createProduct({
    name: data.name,
    description: data.description,
  });
  if (data.category_ids?.length) {
    await ProductModel.setProductCategories(product_id, data.category_ids);
  }
  return { product_id };
}

export async function updateProduct(
  product_id: number,
  data: { name?: string; description?: string; category_ids?: number[] },
) {
  const product = await ProductModel.findProductById(product_id);
  if (!product) throw new ApiError(404, "Product not found");

  const update: any = {};
  if (data.name) update.name = data.name;
  if (data.description) update.description = data.description;
  if (Object.keys(update).length)
    await ProductModel.updateProduct(product_id, update);
  if (data.category_ids)
    await ProductModel.setProductCategories(product_id, data.category_ids);

  return ProductModel.findProductById(product_id);
}

export async function deleteProduct(product_id: number) {
  const product = await ProductModel.findProductById(product_id);
  if (!product) throw new ApiError(404, "Product not found");
  await ProductModel.deleteProduct(product_id);
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
) {
  const cat = await CategoryModel.findCategoryById(category_id);
  if (!cat) throw new ApiError(404, "Category not found");
  return ProductModel.findProductsByCategory(category_id, page, limit);
}

export async function createCategory(data: {
  name: string;
  parent_id?: number | null;
}) {
  if (data.parent_id) {
    const parent = await CategoryModel.findCategoryById(data.parent_id);
    if (!parent) throw new ApiError(404, "Parent category not found");
  }
  const category_id = await CategoryModel.createCategory(data);
  return { category_id };
}

export async function updateCategory(
  category_id: number,
  data: { name?: string; parent_id?: number | null },
) {
  const cat = await CategoryModel.findCategoryById(category_id);
  if (!cat) throw new ApiError(404, "Category not found");
  await CategoryModel.updateCategory(category_id, data);
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
