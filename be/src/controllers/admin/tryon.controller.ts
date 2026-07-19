import { Request, Response } from 'express';
import axios from 'axios';
import { catchAsync } from '../../utils/catchAsync.js';
import { ApiError } from '../../utils/ApiError.js';
import * as tryonConfig from '../../config/tryon.js';

/**
 * PUT /api/admin/tryon/endpoint
 * Body: { base_url, shared_secret }
 * Health-checks the URL before accepting it, so a stale/typo'd tunnel URL
 * never gets registered silently.
 */
export const setTryonEndpoint = catchAsync(async (req: Request, res: Response) => {
  const { base_url, shared_secret } = req.body as { base_url: string; shared_secret: string };
  const normalized = base_url.replace(/\/+$/, '');

  try {
    await axios.get(`${normalized}/health`, { timeout: 5000 });
  } catch {
    throw new ApiError(
      502,
      'Endpoint did not respond to /health — check the Kaggle notebook is running and the URL is correct',
    );
  }

  tryonConfig.setEndpoint(normalized, shared_secret);
  tryonConfig.recordHealthCheck(true);

  res.status(200).json({ registered: true, base_url: normalized });
});

/**
 * GET /api/admin/tryon/endpoint
 * Never echoes the shared_secret back.
 */
export const getTryonEndpoint = catchAsync(async (_req: Request, res: Response) => {
  const { base_url, last_health_check_at, last_health_check_ok } = tryonConfig.getEndpoint();

  res.status(200).json({
    base_url,
    online: last_health_check_ok,
    last_health_check_at,
  });
});
