import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { tryonUpload } from "../middleware/tryonUpload.js";
import { tryonLimiter } from "../middleware/rateLimiter.js";
import * as TryonController from "../controllers/tryon.controller.js";

const router = Router();
router.use(authenticate);

// 5 requests per 10 min per user (tryonLimiter from middleware/rateLimiter.ts)
router.post(
  "/session",
  tryonLimiter,
  tryonUpload.single("photo"),
  TryonController.createSession,
);
router.post("/preview", TryonController.submitPreview);
router.get("/preview/:session_id", TryonController.pollSession);
router.delete("/session/:session_id", TryonController.deleteSession);

export default router;
