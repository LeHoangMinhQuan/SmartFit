import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { Request } from "express";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";

/**
 * Product image upload middleware (FR-14).
 *
 * Uploads to S3 under products/{uuid}.ext
 * The resulting s3_url is stored in product_image.s3_url by the service layer.
 * product_image.image_id is a plain INT — the service must supply it on insert.
 *
 * Limits: 10 files max, 5 MB each, jpeg/png/webp only.
 */

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILE_COUNT = 10;

const s3 = new S3Client({ region: env.AWS_REGION });

const s3Storage = multerS3({
  s3,
  bucket: env.S3_BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (_req: Request, file: Express.Multer.File, cb: multerS3.KeyCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `products/${uuidv4()}${ext}`);
  },
});

const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE" as multer.ErrorCode,
        `Unsupported file type "${file.mimetype}". Allowed: jpeg, png, webp`,
      ),
    );
  }
};

const uploader = multer({
  storage: s3Storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILE_COUNT,
  },
});

/** POST /api/uploads/images — single image, field name: "image" */
export const uploadSingle = uploader.single("image");

/** POST /api/uploads/images/bulk + POST /api/products/:id/images — field name: "images" */
export const uploadBulk = uploader.array("images", MAX_FILE_COUNT);
