import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authenticateStaff } from "../middleware/authenticateStaff.js";
import { validate } from "../middleware/validate.js";
import * as OrderController from "../controllers/order.controller.js";
import {
  createOrderSchema,
  orderParamsSchema,
  listOrdersSchema,
  updateOrderStatusSchema,
} from "../schemas/order.schema.js";

const router = Router();

// Customer order routes
router.post(
  "/",
  authenticate,
  validate(createOrderSchema),
  OrderController.createOrder,
);
router.get(
  "/",
  authenticate,
  validate(listOrdersSchema),
  OrderController.getUserOrders,
);
router.get(
  "/:order_id",
  authenticate,
  validate(orderParamsSchema),
  OrderController.getOrderDetail,
);
router.patch(
  "/:order_id/cancel",
  authenticate,
  validate(orderParamsSchema),
  OrderController.cancelOrder,
);

export default router;
