import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authenticateStaff } from "../middleware/authenticateStaff.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { uploadSingle, uploadBulk } from "../middleware/upload.js";
import * as ProductController from "../controllers/product.controller.js";
import {
  listProductsSchema,
  searchProductsSchema,
  topSellingProductsSchema,
  productParamsSchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  variantParamsSchema,
  upsertPriceSchema,
  createAttributeSchema,
  attachAttributeSchema,
  updateAttributeValueSchema,
  categorySchema,
  submitReviewSchema,
} from "../schemas/product.schema.js";

const router = Router();

// ─── Attributes (global catalog) ─────────────────────────────────────────────
// Separate /attributes router — mounted at /api/attributes in app.ts
export const attributeRouter = Router();
attributeRouter.get("/", ProductController.listAttributes);
// Attributes are part of the product-editing workflow (variant attribute
// values reference this catalog), not a separate destructive action —
// staff-allowed, consistent with product/variant create-update below.
attributeRouter.post(
  "/",
  authenticateStaff,
  authorize("admin", "staff"),
  validate(createAttributeSchema),
  ProductController.createAttribute,
);

// ─── Categories ───────────────────────────────────────────────────────────────
// Mounted at /api/categories
export const categoryRouter = Router();
categoryRouter.get("/", ProductController.getCategoryTree);
categoryRouter.post(
  "/",
  authenticateStaff,
  authorize("admin", "staff"),
  validate(categorySchema),
  ProductController.createCategory,
);

categoryRouter.get("/featured", ProductController.getFeaturedCategories);

categoryRouter.post(
  "/:category_id/image",
  authenticateStaff,
  authorize("admin", "staff"),
  uploadSingle, // category has a single image_url column — single-file upload, field name "image"
  ProductController.uploadCategoryImage,
);

categoryRouter.put(
  "/:category_id",
  authenticateStaff,
  authorize("admin", "staff"),
  validate(categorySchema),
  ProductController.updateCategory,
);
// Delete is admin-only per the agreed decision (product/category delete —
// admin only).
categoryRouter.delete(
  "/:category_id",
  authenticateStaff,
  authorize("admin"),
  ProductController.deleteCategory,
);
categoryRouter.get(
  "/:category_id/products",
  ProductController.getProductsByCategory,
);

// ─── Products ─────────────────────────────────────────────────────────────────
// IMPORTANT: /search must be registered BEFORE /:id to avoid being swallowed
router.get(
  "/search",
  validate(searchProductsSchema),
  ProductController.searchProducts,
);
router.get(
  "/top-selling",
  validate(topSellingProductsSchema),
  ProductController.getTopSellingProducts,
);
router.get("/", validate(listProductsSchema), ProductController.listProducts);
router.get("/:id", validate(productParamsSchema), ProductController.getProduct);
router.post(
  "/",
  authenticateStaff,
  authorize("admin", "staff"),
  validate(createProductSchema),
  ProductController.createProduct,
);
router.put(
  "/:id",
  authenticateStaff,
  authorize("admin", "staff"),
  validate(updateProductSchema),
  ProductController.updateProduct,
);
router.patch(
  "/:id",
  authenticateStaff,
  authorize("admin", "staff"),
  validate(updateProductSchema),
  ProductController.updateProduct,
);
// Delete is admin-only per the agreed decision (product/category delete —
// admin only).
router.delete(
  "/:id",
  authenticateStaff,
  authorize("admin"),
  validate(productParamsSchema),
  ProductController.deleteProduct,
);

// Images
router.post(
  "/:id/images",
  authenticateStaff,
  authorize("admin", "staff"),
  uploadBulk,
  ProductController.uploadProductImage,
);

// ─── Variants ─────────────────────────────────────────────────────────────────
router.get(
  "/:id/variants",
  validate(productParamsSchema),
  ProductController.getVariants,
);
router.post(
  "/:id/variants",
  authenticateStaff,
  authorize("admin", "staff"),
  validate(createVariantSchema),
  ProductController.createVariant,
);
router.put(
  "/:id/variants/:variant_id",
  authenticateStaff,
  authorize("admin", "staff"),
  validate(variantParamsSchema),
  ProductController.updateVariant,
);
// Delete is admin-only — plan explicitly calls out
// "DELETE /:id/variants/:variant_id" alongside product delete.
router.delete(
  "/:id/variants/:variant_id",
  authenticateStaff,
  authorize("admin"),
  validate(variantParamsSchema),
  ProductController.deleteVariant,
);
router.post(
  "/:id/variants/:variant_id/price",
  authenticateStaff,
  authorize("admin", "staff"),
  validate(upsertPriceSchema),
  ProductController.upsertVariantPrice,
);

// Variant attributes
router.post(
  "/:product_id/variants/:variant_id/attributes",
  authenticateStaff,
  authorize("admin", "staff"),
  validate(attachAttributeSchema),
  ProductController.attachAttribute,
);
router.patch(
  "/:product_id/variants/:variant_id/attributes/:attribute_id",
  authenticateStaff,
  authorize("admin", "staff"),
  validate(updateAttributeValueSchema),
  ProductController.updateAttributeValue,
);
// Not explicitly named in the plan's delete exceptions, but it's a
// sub-resource delete on the same variant the plan gates admin-only —
// kept consistent with that rather than left as an unguarded staff gap.
router.delete(
  "/:product_id/variants/:variant_id/attributes/:attribute_id",
  authenticateStaff,
  authorize("admin"),
  ProductController.removeAttribute,
);

// ─── Reviews ─────────────────────────────────────────────────────────────────
router.get("/:id/reviews", ProductController.getProductReviews);
router.post(
  "/:product_id/variants/:variant_id/reviews",
  authenticate,
  validate(submitReviewSchema),
  ProductController.submitReview,
);

export default router;
