import { Router } from "express";
import { authenticateStaff } from "../middleware/authenticateStaff.js";
import { uploadSingle, uploadBulk } from "../middleware/upload.js";
import * as UploadController from "../controllers/upload.controller.js";

const router = Router();
router.use(authenticateStaff);

// Single image upload
router.post("/images", uploadSingle, UploadController.uploadImage);

// Bulk upload — up to 10 images (max 5MB each, enforced by upload middleware)
router.post(
  "/images/bulk",
  uploadBulk,
  UploadController.uploadImages,
);

export default router;
