import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as ProductService from "../services/product.service.js";
import { cdnUrlForKey } from "../services/storage.service.js";

// ─── Products ─────────────────────────────────────────────────────────────────

export const listProducts = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, sort, category_id, minPrice, maxPrice, attribute_id } =
    req.query as any;
  const result = await ProductService.listProducts({
    page,
    limit,
    sort,
    category_id,
    minPrice,
    maxPrice,
    attribute_id,
  });
  res.json({
    data: result.rows,
    meta: {
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
      total: result.total,
    },
  });
});

export const searchProducts = catchAsync(
  async (req: Request, res: Response) => {
    const { q, page, limit } = req.query as any;
    const result = await ProductService.searchProducts(q, page, limit);
    res.json({
      data: result.rows,
      meta: {
        page: Number(page ?? 1),
        limit: Number(limit ?? 20),
        total: result.total,
      },
    });
  },
);

export const getProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await ProductService.getProduct(Number(req.params["id"]));
  res.json({ data: product });
});

export const createProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.createProduct(req.body);
  res.status(201).json({ data: result });
});

export const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await ProductService.updateProduct(
    Number(req.params["id"]),
    req.body,
  );
  res.json({ data: product });
});

export const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  await ProductService.deleteProduct(Number(req.params["id"]));
  res.status(204).send();
});

export const uploadProductImage = catchAsync(
  async (req: Request, res: Response) => {
    const files = req.files as Express.MulterS3.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ message: "No images uploaded" });
      return;
    }
    const variant_id = req.body.variant_id
      ? Number(req.body.variant_id)
      : undefined;
    const image_ids: number[] = [];
    for (const file of files) {
      const s3_url = cdnUrlForKey(file.key);
      const result = await ProductService.addProductImage(
        Number(req.params["id"]),
        variant_id,
        s3_url,
      );
      image_ids.push(result.image_id);
    }
    res.status(201).json({ data: { image_ids } });
  },
);

// ─── Variants ─────────────────────────────────────────────────────────────────

export const getVariants = catchAsync(async (req: Request, res: Response) => {
  const variants = await ProductService.getVariants(Number(req.params["id"]));
  res.json({ data: variants });
});

export const createVariant = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.createVariant(
    Number(req.params["id"]),
    req.body,
  );
  res.status(201).json({ data: result });
});

export const updateVariant = catchAsync(async (req: Request, res: Response) => {
  await ProductService.updateVariant(
    Number(req.params["id"]),
    Number(req.params["variant_id"]),
    req.body,
  );
  res.json({ data: { message: "Variant updated" } });
});

export const deleteVariant = catchAsync(async (req: Request, res: Response) => {
  await ProductService.deleteVariant(
    Number(req.params["id"]),
    Number(req.params["variant_id"]),
  );
  res.status(204).send();
});

export const upsertVariantPrice = catchAsync(
  async (req: Request, res: Response) => {
    await ProductService.upsertVariantPrice(
      Number(req.params["id"]),
      Number(req.params["variant_id"]),
      req.body,
    );
    res.json({ data: { message: "Price updated" } });
  },
);

// ─── Attributes ───────────────────────────────────────────────────────────────

export const listAttributes = catchAsync(
  async (_req: Request, res: Response) => {
    const attributes = await ProductService.listAttributes();
    res.json({ data: attributes });
  },
);

export const createAttribute = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ProductService.createAttribute(req.body.name);
    res.status(201).json({ data: result });
  },
);

export const attachAttribute = catchAsync(
  async (req: Request, res: Response) => {
    await ProductService.attachAttribute(
      Number(req.params["product_id"]),
      Number(req.params["variant_id"]),
      req.body,
    );
    res.status(201).json({ data: { message: "Attribute attached" } });
  },
);

export const updateAttributeValue = catchAsync(
  async (req: Request, res: Response) => {
    await ProductService.updateAttributeValue(
      Number(req.params["product_id"]),
      Number(req.params["variant_id"]),
      Number(req.params["attribute_id"]),
      req.body.value,
    );
    res.json({ data: { message: "Attribute value updated" } });
  },
);

export const removeAttribute = catchAsync(
  async (req: Request, res: Response) => {
    await ProductService.removeAttribute(
      Number(req.params["product_id"]),
      Number(req.params["variant_id"]),
      Number(req.params["attribute_id"]),
    );
    res.status(204).send();
  },
);

// ─── Categories ───────────────────────────────────────────────────────────────

export const getCategoryTree = catchAsync(
  async (_req: Request, res: Response) => {
    const tree = await ProductService.getCategoryTree();
    res.json({ data: tree });
  },
);

export const getProductsByCategory = catchAsync(
  async (req: Request, res: Response) => {
    const { page, limit } = req.query as any;
    const result = await ProductService.getProductsByCategory(
      Number(req.params["category_id"]),
      page,
      limit,
    );
    res.json({ data: result.rows, meta: { total: result.total } });
  },
);

export const createCategory = catchAsync(
  async (req: Request, res: Response) => {
    const result = await ProductService.createCategory(req.body);
    res.status(201).json({ data: result });
  },
);

export const updateCategory = catchAsync(
  async (req: Request, res: Response) => {
    await ProductService.updateCategory(
      Number(req.params["category_id"]),
      req.body,
    );
    res.json({ data: { message: "Category updated" } });
  },
);

export const deleteCategory = catchAsync(
  async (req: Request, res: Response) => {
    await ProductService.deleteCategory(Number(req.params["category_id"]));
    res.status(204).send();
  },
);

export const getFeaturedCategories = catchAsync(
  async (_req: Request, res: Response) => {
    const categories = await ProductService.getFeaturedCategories();
    res.json({ data: categories });
  },
);

export const uploadCategoryImage = catchAsync(
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    const s3Url = cdnUrlForKey((req.file as Express.MulterS3.File).key);
    const category_id = Number(req.params["category_id"]);
    const result = await ProductService.setCategoryImage(category_id, s3Url);
    res.json({ data: result });
  },
);

// ─── Reviews ─────────────────────────────────────────────────────────────────

export const getProductReviews = catchAsync(
  async (req: Request, res: Response) => {
    const { page, limit } = req.query as any;
    const result = await ProductService.getProductReviews(
      Number(req.params["id"]),
      page,
      limit,
    );
    res.json({
      data: result.rows,
      meta: { total: result.total, avg_rating: result.avg_rating },
    });
  },
);

export const submitReview = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  const result = await ProductService.submitReview(
    Number(req.params["product_id"]),
    Number(req.params["variant_id"]),
    user_id,
    req.body,
  );
  res.status(201).json({ data: result });
});
