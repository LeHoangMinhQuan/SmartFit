import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { chatLimiter } from "../middleware/rateLimiter.js";
import {
  chatMessageSchema,
  chatSessionIdParamSchema,
} from "../schemas/chat.schema.js";
import * as chatController from "../controllers/chat.controller.js";

const router = Router();

// authenticate MUST run before chatLimiter — the limiter keys by
// req.user.user_id, which authenticate is what populates.
router.post(
  "/message",
  authenticate,
  chatLimiter,
  validate(chatMessageSchema),
  chatController.sendMessage,
);

router.get(
  "/session/:session_id",
  authenticate,
  validate(chatSessionIdParamSchema),
  chatController.getHistory,
);

router.delete(
  "/session/:session_id",
  authenticate,
  validate(chatSessionIdParamSchema),
  chatController.deleteSession,
);

export default router;
