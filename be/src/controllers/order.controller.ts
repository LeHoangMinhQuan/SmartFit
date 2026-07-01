import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as OrderService from "../services/order.service.js";

export const createOrder = catchAsync(async (req: Request, res: Response) => {
  const result = await OrderService.createOrder(
    (req as any).user.user_id,
    req.body,
  );
  res.status(201).json({ data: result });
});

export const getUserOrders = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as any;
  const result = await OrderService.getUserOrders(
    (req as any).user.user_id,
    page,
    limit,
  );
  res.json({ data: result.rows, meta: { total: result.total } });
});

export const getOrderDetail = catchAsync(
  async (req: Request, res: Response) => {
    const result = await OrderService.getOrderDetail(
      Number(req.params.order_id),
      (req as any).user.user_id,
    );
    res.json({ data: result });
  },
);

export const cancelOrder = catchAsync(async (req: Request, res: Response) => {
  await OrderService.cancelOrder(
    Number(req.params.order_id),
    (req as any).user.user_id,
  );
  res.json({ data: { message: "Order cancelled" } });
});

// ─── Admin ─────────────────────────────────────────────────────────────────────

export const adminListOrders = catchAsync(
  async (req: Request, res: Response) => {
    const result = await OrderService.adminListOrders(req.query as any);
    res.json({ data: result.rows, meta: { total: result.total } });
  },
);

export const adminGetOrderDetail = catchAsync(
  async (req: Request, res: Response) => {
    const result = await OrderService.adminGetOrderDetail(
      Number(req.params.order_id),
    );
    res.json({ data: result });
  },
);

export const adminUpdateStatus = catchAsync(
  async (req: Request, res: Response) => {
    await OrderService.adminUpdateStatus(
      Number(req.params.order_id),
      req.body.status,
    );
    res.json({ data: { message: "Order status updated" } });
  },
);
