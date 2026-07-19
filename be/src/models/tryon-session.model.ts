import db from '../config/db.js';
import type { TryonFailureReason } from '../config/tryon.js';

export interface TryonSessionRow {
  session_id: number;
  user_id: number;
  product_id: number;
  variant_id: number;
  user_photo_url: string;
  result_url: string | null;
  status: 'processing' | 'ready' | 'failed';
  failure_reason: TryonFailureReason | null;
  created_at: Date;
  expires_at: Date;
}

const TABLE = 'tryon_session';

export async function insertSession(params: {
  user_id: number;
  product_id: number;
  variant_id: number;
  user_photo_url: string;
}): Promise<Pick<TryonSessionRow, 'session_id' | 'expires_at'>> {
  const [row] = await db(TABLE)
    .insert({
      user_id: params.user_id,
      product_id: params.product_id,
      variant_id: params.variant_id,
      user_photo_url: params.user_photo_url,
    })
    .returning(['session_id', 'expires_at']);
  return row;
}

export async function findSessionById(
  session_id: number,
): Promise<TryonSessionRow | undefined> {
  return db<TryonSessionRow>(TABLE).where({ session_id }).first();
}

export async function markProcessing(session_id: number): Promise<void> {
  await db(TABLE)
    .where({ session_id })
    .update({ status: 'processing', failure_reason: null, result_url: null });
}

export async function markReady(session_id: number, result_url: string): Promise<void> {
  await db(TABLE).where({ session_id }).update({ status: 'ready', result_url });
}

export async function markFailed(
  session_id: number,
  reason: TryonFailureReason,
): Promise<void> {
  await db(TABLE).where({ session_id }).update({ status: 'failed', failure_reason: reason });
}

export async function deleteSessionById(session_id: number): Promise<void> {
  await db(TABLE).where({ session_id }).del();
}

/** Garment image for the variant a tryon_session is scoped to. */
export async function findGarmentImageUrl(
  product_id: number,
  variant_id: number,
): Promise<string | undefined> {
  const row = await db('product_image')
    .where({ product_id, variant_id })
    .first('s3_url');
  return row?.s3_url;
}
