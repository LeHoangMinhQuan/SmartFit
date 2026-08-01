import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as EmbeddingService from "../services/embedding.service.js";

/**
 * POST /api/admin/chat/reindex
 * Bulk re-embeds every product. Needed once at bootstrap and after any
 * manual DB edits/seed script runs (chatbot build plan, Phase 2).
 */
export const reindexProductEmbeddings = catchAsync(
  async (_req: Request, res: Response) => {
    const result = await EmbeddingService.reindexAll();
    res.status(200).json(result);
  },
);
