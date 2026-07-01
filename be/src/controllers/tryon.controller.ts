import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as TryonService from "../services/tryon.service.js";

export const createSession = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  const file = req.file as Express.Multer.File & { location?: string };
  const photoPath = file.location ?? file.path;
  const { product_id, variant_id } = req.body;

  const result = await TryonService.createSession(
    user_id,
    Number(product_id),
    Number(variant_id),
    photoPath,
  );
  res.status(201).json({ data: result });
});

export const submitPreview = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  const { session_id, product_id, variant_id } = req.body;
  const result = await TryonService.submitPreview(
    user_id,
    Number(session_id),
    Number(product_id),
    Number(variant_id),
  );
  res.json({ data: result });
});

export const pollSession = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  const result = await TryonService.pollSession(
    user_id,
    Number(req.params.session_id),
  );
  res.json({ data: result });
});

export const deleteSession = catchAsync(async (req: Request, res: Response) => {
  const user_id = (req as any).user.user_id;
  await TryonService.deleteSession(user_id, Number(req.params.session_id));
  res.status(204).send();
});
