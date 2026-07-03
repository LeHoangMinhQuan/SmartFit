import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { tryonUpload } from "../middleware/tryonUpload.js";
import { tryonLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import * as TryonController from "../controllers/tryon.controller.js";
import {
  createSessionSchema,
  submitPreviewSchema,
  sessionParamsSchema,
} from "../schemas/tryon.schema.js";

const router = Router();
router.use(authenticate);

// 5 requests per 10 min per user (tryonLimiter from middleware/rateLimiter.ts)
router.post(
  "/session",
  tryonLimiter,
  tryonUpload.single("photo"),
  validate(createSessionSchema),
  TryonController.createSession,
);
router.post("/preview", validate(submitPreviewSchema), TryonController.submitPreview);
router.get("/preview/:session_id", validate(sessionParamsSchema), TryonController.pollSession);
router.delete("/session/:session_id", validate(sessionParamsSchema), TryonController.deleteSession);

export default router;
