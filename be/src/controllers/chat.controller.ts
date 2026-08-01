import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as chatService from "../services/chat.service.js";

/**
 * POST /api/chat/message
 *
 * Streaming response — the one endpoint in this API that breaks from the
 * plain-JSON convention (see swagger.yaml for the explicit note on that).
 * StreamTextResult#pipeUIMessageStreamToResponse writes directly to the
 * Node ServerResponse (Express's `res` extends it), encoding to the AI
 * SDK's SSE-based data-stream protocol itself — no manual header/stream
 * bridging needed.
 *
 * The resolved session_id (a new one, if the request didn't send one) is
 * sent two ways: as a plain response header (X-Chat-Session-Id, handy for
 * curl/Postman testing) AND via the AI SDK's messageMetadata mechanism, so
 * it lands on the assistant UIMessage itself as `message.metadata.session_id`
 * — that's the one the frontend (useChat's onFinish) actually reads, per
 * ecommerce-fe-plan.md §11.
 */
export const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const { session_id, message } = req.body as {
    session_id?: number;
    message: string;
  };

  console.log("[chat.controller] POST /chat/message", {
    user_id: req.user?.user_id,
    session_id,
    message_preview: message?.slice(0, 80),
  });

  const { session_id: resolvedSessionId, result } =
    await chatService.sendMessage(req.user!.user_id, session_id, message);

  console.log("[chat.controller] piping stream to response", {
    resolvedSessionId,
  });

  try {
    await result.pipeUIMessageStreamToResponse(res, {
      headers: { "X-Chat-Session-Id": String(resolvedSessionId) },
      messageMetadata: () => ({ session_id: resolvedSessionId }),
    });
    console.log(
      "[chat.controller] pipeUIMessageStreamToResponse resolved — stream closed",
      {
        resolvedSessionId,
      },
    );
  } catch (err) {
    console.error("[chat.controller] pipeUIMessageStreamToResponse threw", err);
    throw err;
  }
});

/** GET /api/chat/session/:session_id */
export const getHistory = catchAsync(async (req: Request, res: Response) => {
  const session_id = Number(req.params["session_id"]);
  const messages = await chatService.getSessionHistory(
    session_id,
    req.user!.user_id,
  );
  res.status(200).json({ session_id, messages });
});

/** DELETE /api/chat/session/:session_id */
export const deleteSession = catchAsync(async (req: Request, res: Response) => {
  const session_id = Number(req.params["session_id"]);
  await chatService.deleteSession(session_id, req.user!.user_id);
  res.status(204).send();
});
