import api from "@/lib/axios";
import type { ChatSessionHistoryResponse } from "@/interfaces";

/**
 * services/chat.service.ts
 *
 * No hand-written "send message" function here — @ai-sdk/react's useChat
 * owns that request via its own transport (see ChatPanel.tsx). This file
 * only covers the two plain-JSON endpoints: reading history and deleting
 * a session.
 */

export const getSessionHistory = async (
  session_id: number,
): Promise<ChatSessionHistoryResponse> => {
  const { data } = await api.get<ChatSessionHistoryResponse>(
    `/chat/session/${session_id}`,
  );
  return data;
};

export const deleteSession = async (session_id: number): Promise<void> => {
  await api.delete(`/chat/session/${session_id}`);
};
