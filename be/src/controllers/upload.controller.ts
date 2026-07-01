import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as ProductModel from "../models/product/product.model.js";

export const uploadImage = catchAsync(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File & { location?: string };
  const s3_url = file.location ?? file.path;
  const { product_id, variant_id } = req.body;

  const image_id = await ProductModel.insertProductImage({
    product_id: Number(product_id),
    variant_id: variant_id ? Number(variant_id) : undefined,
    s3_url,
  });

  res.status(201).json({ data: { image_id, s3_url } });
});

export const uploadImages = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as (Express.Multer.File & { location?: string })[];
  const { product_id, variant_id } = req.body;

  const images = files.map((f) => ({
    product_id: Number(product_id),
    variant_id: variant_id ? Number(variant_id) : undefined,
    s3_url: f.location ?? f.path,
  }));

  const image_ids = await ProductModel.insertProductImages(images);
  res.status(201).json({ data: { image_ids } });
});
