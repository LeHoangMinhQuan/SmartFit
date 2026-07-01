import { Router } from "express";
import { authenticate }from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import * as CartController from "../controllers/cart.controller.js";
import {
  addCartItemSchema,
  updateCartItemSchema,
  removeCartItemSchema,
  mergeCartSchema,
} from "../schemas/cart.schema.js";

const router = Router();
router.use(authenticate);

router.get("/", CartController.getCart);
router.post("/items", validate(addCartItemSchema), CartController.addItem);
router.patch(
  "/items",
  validate(updateCartItemSchema),
  CartController.updateItem,
);
router.delete(
  "/items",
  validate(removeCartItemSchema),
  CartController.removeItem,
);
router.delete("/", CartController.clearCart);
router.post("/merge", validate(mergeCartSchema), CartController.mergeCart);

export default router;
