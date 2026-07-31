import { z } from "zod";

/** POST /api/chat/message */
export const chatMessageSchema = z.object({
  body: z.object({
    // Omitted -> chat.service.sendMessage creates a new session.
    session_id: z.coerce.number().int().positive().optional(),
    message: z.string().min(1).max(2000),
  }),
});

/** GET /api/chat/session/:session_id, DELETE /api/chat/session/:session_id */
export const chatSessionIdParamSchema = z.object({
  params: z.object({
    session_id: z.coerce.number().int().positive(),
  }),
});
