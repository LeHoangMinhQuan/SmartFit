import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync.js';
import { ApiError } from '../utils/ApiError.js';
import * as tryonService from '../services/tryon.service.js';

export const createSession = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, 'photo is required');

  const file = req.file as Express.MulterS3.File;
  const { product_id, variant_id } = req.body as { product_id: number; variant_id: number };

  const result = await tryonService.uploadUserPhoto({
    file,
    user_id: req.user!.user_id,
    product_id,
    variant_id,
  });

  res.status(201).json(result);
});

export const requestPreview = catchAsync(async (req: Request, res: Response) => {
  const { session_id, cloth_type } = req.body;

  const result = await tryonService.requestPreview({
    session_id,
    cloth_type,
    user_id: req.user!.user_id,
  });

  res.status(202).json(result);
});

export const getPreview = catchAsync(async (req: Request, res: Response) => {
  const session_id = Number(req.params['session_id']);
  const result = await tryonService.getPreviewStatus(session_id, req.user!.user_id);
  res.status(200).json(result);
});

export const deleteSession = catchAsync(async (req: Request, res: Response) => {
  const session_id = Number(req.params['session_id']);
  await tryonService.deleteSession(session_id, req.user!.user_id);
  res.status(204).send();
});
