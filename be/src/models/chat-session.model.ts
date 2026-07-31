import db from "../config/db.js";

export interface ChatSessionRow {
  session_id: number;
  user_id: number;
  created_at: Date;
  updated_at: Date;
}

export interface ChatMessageRow {
  message_id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

const SESSION_TABLE = "chat_session";
const MESSAGE_TABLE = "chat_message";

export async function insertSession(
  user_id: number,
): Promise<Pick<ChatSessionRow, "session_id">> {
  const [row] = await db(SESSION_TABLE)
    .insert({ user_id })
    .returning(["session_id"]);
  return row;
}

export async function findSessionById(
  session_id: number,
): Promise<ChatSessionRow | undefined> {
  return db<ChatSessionRow>(SESSION_TABLE).where({ session_id }).first();
}

export async function touchSession(session_id: number): Promise<void> {
  await db(SESSION_TABLE)
    .where({ session_id })
    .update({ updated_at: db.fn.now() });
}

export async function deleteSessionById(session_id: number): Promise<void> {
  // chat_message rows cascade-delete via the FK in sql/chatbot_schema.sql —
  // no need to delete them explicitly here.
  await db(SESSION_TABLE).where({ session_id }).del();
}

/** Most recent `limit` messages for a session, in chronological (oldest-first) order. */
export async function findRecentMessages(
  session_id: number,
  limit: number,
): Promise<ChatMessageRow[]> {
  const rows = await db<ChatMessageRow>(MESSAGE_TABLE)
    .where({ session_id })
    .orderBy("created_at", "desc")
    .limit(limit);
  return rows.reverse();
}

export async function insertMessage(params: {
  session_id: number;
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await db(MESSAGE_TABLE).insert({
    session_id: params.session_id,
    role: params.role,
    content: params.content,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
  });
}
