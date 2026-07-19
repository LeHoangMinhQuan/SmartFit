import multer from 'multer';
import multerS3 from 'multer-s3';
import { randomUUID } from 'crypto';
import { s3 } from '../config/s3.js';
import { env } from '../config/env.js';
import { tryonConstants } from '../config/tryon.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Single-field ('photo') multipart upload straight to S3 under the private
 * tryon-sessions/ prefix. Runs before schema validation in the route chain
 * so req.body.product_id / req.body.variant_id are populated by the time
 * validate(tryonSessionUploadSchema) runs.
 */
export const tryonUpload = multer({
  storage: multerS3({
    s3,
    bucket: env.S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const sessionUuid = randomUUID();
      const ext = file.mimetype.split('/')[1];
      cb(null, `${tryonConstants.S3_PREFIX}/${sessionUuid}/user.${ext}`);
    },
  }),
  limits: {
    fileSize: tryonConstants.MAX_PHOTO_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!tryonConstants.ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      cb(new ApiError(400, 'Only jpeg, png, and webp images are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('photo');
