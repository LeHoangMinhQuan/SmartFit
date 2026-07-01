import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as VNPayService from "../services/vnpay.service.js";

export const createPaymentUrl = catchAsync(
  async (req: Request, res: Response) => {
    const { order_id } = req.body;
    const user_id = (req as any).user.user_id;
    const ip = req.ip ?? req.socket.remoteAddress ?? "127.0.0.1";
    const result = await VNPayService.createPaymentUrl(
      Number(order_id),
      user_id,
      ip,
    );
    res.json({ data: result });
  },
);

// Return URL — display only, no DB writes
export const vnpayReturn = (_req: Request, res: Response) => {
  res.json({
    data: {
      message: "Payment return received — check order status for result",
    },
  });
};

/**
 * IPN handler — must NEVER call next(err).
 * VNPay expects { RspCode, Message } shape, not the standard error handler shape.
 * Registered BEFORE express.json() with express.urlencoded({ extended: false }).
 */
export const vnpayIpn = async (
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  try {
    const result = await VNPayService.handleIpn(
      req.body as Record<string, string>,
    );
    res.json(result);
  } catch (err) {
    console.error("[IPN] Unexpected error:", err);
    res.json({ RspCode: "99", Message: "Internal error" });
  }
};
