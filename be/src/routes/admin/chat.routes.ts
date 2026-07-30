import { Router } from "express";
import { authenticateStaff } from "../../middleware/authenticateStaff.js";
import { authorize } from "../../middleware/authorize.js";
import * as adminChatController from "../../controllers/admin/chat.controller.js";

const router = Router();

router.post(
  "/reindex",
  authenticateStaff,
  authorize("admin"),
  adminChatController.reindexProductEmbeddings,
);

export default router;
