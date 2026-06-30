import db from "../config/db.js";

export type TryonStatus = "processing" | "ready" | "failed";

export interface TryonSession {
  session_id?: number; // IDENTITY — never supply on insert
  user_id: number;
  product_id: number;
  variant_id: number;
  user_photo_url: string;
  result_url?: string | null;
  status?: TryonStatus; // DEFAULT 'processing'
  // created_at: DEFAULT NOW()
  // expires_at: DEFAULT (NOW() + INTERVAL '1 hour') — do NOT compute in app
}

export async function createTryonSession(
  data: Omit<TryonSession, "session_id" | "status">,
): Promise<{ session_id: number; expires_at: string }> {
  const [row] = await db("tryon_session")
    .insert(data)
    .returning(["session_id", "expires_at"]);
  return row;
}

export async function findTryonSession(session_id: number) {
  return db("tryon_session").where({ session_id }).first();
}

export async function findTryonSessionByUser(
  session_id: number,
  user_id: number,
) {
  return db("tryon_session").where({ session_id, user_id }).first();
}

export async function updateTryonSession(
  session_id: number,
  data: Partial<Pick<TryonSession, "result_url" | "status">>,
) {
  return db("tryon_session").where({ session_id }).update(data);
}

export async function deleteTryonSession(session_id: number) {
  return db("tryon_session").where({ session_id }).delete();
}
