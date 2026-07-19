import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authenticateStaff } from "../middleware/authenticateStaff.js";
import { validate } from "../middleware/validate.js";
import { uploadSingle, uploadBulk } from "../middleware/upload.js";
import * as ProductController from "../controllers/product.controller.js";
import {
  listProductsSchema,
  searchProductsSchema,
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
attributeRouter.post(
  "/",
  authenticateStaff,
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
  validate(categorySchema),
  ProductController.createCategory,
);
categoryRouter.put(
  "/:category_id",
  authenticateStaff,
  validate(categorySchema),
  ProductController.updateCategory,
);
categoryRouter.delete(
  "/:category_id",
  authenticateStaff,
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
router.get("/", validate(listProductsSchema), ProductController.listProducts);
router.get("/:id", validate(productParamsSchema), ProductController.getProduct);
router.post(
  "/",
  authenticateStaff,
  validate(createProductSchema),
  ProductController.createProduct,
);
router.put(
  "/:id",
  authenticateStaff,
  validate(updateProductSchema),
  ProductController.updateProduct,
);
router.patch(
  "/:id",
  authenticateStaff,
  validate(updateProductSchema),
  ProductController.updateProduct,
);
router.delete(
  "/:id",
  authenticateStaff,
  validate(productParamsSchema),
  ProductController.deleteProduct,
);

// Images
router.post(
  "/:id/images",
  authenticateStaff,
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
  validate(createVariantSchema),
  ProductController.createVariant,
);
router.put(
  "/:id/variants/:variant_id",
  authenticateStaff,
  validate(variantParamsSchema),
  ProductController.updateVariant,
);
router.delete(
  "/:id/variants/:variant_id",
  authenticateStaff,
  validate(variantParamsSchema),
  ProductController.deleteVariant,
);
router.post(
  "/:id/variants/:variant_id/price",
  authenticateStaff,
  validate(upsertPriceSchema),
  ProductController.upsertVariantPrice,
);

// Variant attributes
router.post(
  "/:product_id/variants/:variant_id/attributes",
  authenticateStaff,
  validate(attachAttributeSchema),
  ProductController.attachAttribute,
);
router.patch(
  "/:product_id/variants/:variant_id/attributes/:attribute_id",
  authenticateStaff,
  validate(updateAttributeValueSchema),
  ProductController.updateAttributeValue,
);
router.delete(
  "/:product_id/variants/:variant_id/attributes/:attribute_id",
  authenticateStaff,
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
