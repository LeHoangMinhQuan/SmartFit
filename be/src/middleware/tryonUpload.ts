import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import { Request } from "express";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";

/**
 * Virtual try-on photo upload middleware (§5).
 *
 * Separate from upload.ts because:
 *   - 10 MB limit (vs 5 MB for product images)
 *   - S3 prefix: tryon-sessions/{uuid}/user.ext
 *     (1-hour lifecycle rule set on the tryon-sessions/ prefix in S3)
 *   - Single file only (user selfie)
 *
 * The S3 folder key (uuid) is attached to req.tryonS3Key so the service
 * can construct the full user_photo_url and pass it to the AI provider.
 * The canonical session_id comes from tryon_session.session_id (INT IDENTITY)
 * returned after the DB INSERT — not from this UUID.
 */

declare module "express-serve-static-core" {
  interface Request {
    tryonS3Key?: string; // S3 folder UUID — set during upload, used by tryon.service.ts
  }
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const s3 = new S3Client({ region: env.AWS_REGION });

const tryonStorage = multerS3({
  s3,
  bucket: env.S3_BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req: Request, file: Express.Multer.File, cb: multerS3.KeyCallback) => {
    const folderKey = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    req.tryonS3Key = folderKey;
    cb(null, `tryon-sessions/${folderKey}/user${ext}`);
  },
});

const tryonFileFilter = (
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
  storage: tryonStorage,
  fileFilter: tryonFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
});

/** POST /api/tryon/session — field name: "photo" */
export const uploadTryonPhoto = tryonUploader.single("photo");
