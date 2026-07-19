import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { tryonLimiter } from '../middleware/rateLimiter.js';
import { tryonUpload } from '../middleware/tryonUpload.js';
import {
  tryonSessionUploadSchema,
  tryonPreviewSchema,
  tryonSessionIdParamSchema,
} from '../schemas/tryon.schema.js';
import * as tryonController from '../controllers/tryon.controller.js';

const router = Router();

// tryonUpload (multer-s3) MUST run before validate() — it's what populates
// req.body from the multipart fields and req.file from the photo field.
router.post(
  '/session',
  authenticate,
  tryonLimiter,
  tryonUpload,
  validate(tryonSessionUploadSchema),
  tryonController.createSession,
);

router.post(
  '/preview',
  authenticate,
  validate(tryonPreviewSchema),
  tryonController.requestPreview,
);

router.get(
  '/preview/:session_id',
  authenticate,
  validate(tryonSessionIdParamSchema),
  tryonController.getPreview,
);

router.delete(
  '/session/:session_id',
  authenticate,
  validate(tryonSessionIdParamSchema),
  tryonController.deleteSession,
);

export default router;
