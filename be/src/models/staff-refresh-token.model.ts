import db from "../config/db.js";

export interface StaffRefreshToken {
  staff_id: number;
  token_id: number;
  token_hash: string;
  expires_at: Date;
}

export async function createStaffRefreshToken(
  staff_id: number,
  token_hash: string,
  expires_at: Date,
): Promise<number> {
  const [row] = await db("staff_refresh_token")
    .insert({ staff_id, token_hash, expires_at })
    .returning("token_id");
  return row.token_id;
}

export async function findStaffRefreshTokenByHash(
  token_hash: string,
): Promise<StaffRefreshToken | undefined> {
  return db("staff_refresh_token").where({ token_hash }).first();
}

export async function deleteStaffRefreshToken(
  staff_id: number,
  token_id: number,
): Promise<number> {
  return db("staff_refresh_token").where({ staff_id, token_id }).delete();
}
