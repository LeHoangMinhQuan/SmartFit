import multer from "multer";
import multerS3 from "multer-s3";
import { Request } from "express";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { s3 } from "../config/s3.js";
import { env } from "../config/env.js";

/**
 * Virtual try-on photo upload middleware (FR-15).
 *
 * Uploads to S3 under tryon-sessions/{uuid}.ext
 * This prefix is deliberately NOT covered by the bucket's public-read policy —
 * these are private user photos. Access is via pre-signed URLs only.
 *
 * S3 credentials come from the shared s3 client (config/s3.ts):
 *  - EC2: IAM instance role via IMDSv2 (no keys needed)
 *
 * Limits: 1 file, 10 MB, jpeg/png/webp only.
 * Rate-limited separately via tryonLimiter in rateLimiter.ts.
 */

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB — user photos may be larger than product images

const s3Storage = multerS3({
  s3,
  bucket: env.S3_BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: any, key?: string) => void,
  ) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Private prefix — NOT covered by public-read bucket policy
    cb(null, `tryon-sessions/${uuidv4()}${ext}`);
  },
});

const photoFileFilter = (
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

const tryonUploader = multer({
  storage: s3Storage,
  fileFilter: photoFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

/** POST /api/tryon/session — single user photo, field name: "photo" */
export const tryonUpload = tryonUploader;
