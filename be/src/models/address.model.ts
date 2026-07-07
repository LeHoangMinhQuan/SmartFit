import db from "../config/db.js";

export interface Address {
  address_id: number;
  address_line: string;
  province_id: number;
  district_id: number;
  ward_id: number;
}

export interface UserAddress extends Address {
  is_default: boolean;
  label: string | null;
}

export interface CreateAddressInput {
  address_line: string;
  province_id: number;
  district_id: number;
  ward_id: number;
}

export interface UpdateAddressInput {
  address_line?: string;
  province_id?: number;
  district_id?: number;
  ward_id?: number;
}

/**
 * List all addresses for a user (via user_address JOIN address)
 */
export async function findUserAddresses(
  user_id: number,
): Promise<UserAddress[]> {
  return db("user_address as ua")
    .join("address as a", "ua.address_id", "a.address_id")
    .where("ua.user_id", user_id)
    .select(
      "a.address_id",
      "a.address_line",
      "a.province_id",
      "a.district_id",
      "a.ward_id",
      "ua.is_default",
      "ua.label",
    );
}

/**
 * Find a single address owned by a user (used to check ownership before update/delete)
 */
export async function findAddressByIdAndUser(
  address_id: number,
  user_id: number,
): Promise<UserAddress | undefined> {
  return db("user_address as ua")
    .join("address as a", "ua.address_id", "a.address_id")
    .where({ "ua.address_id": address_id, "ua.user_id": user_id })
    .first(
      "a.address_id",
      "a.address_line",
      "a.province_id",
      "a.district_id",
      "a.ward_id",
      "ua.is_default",
      "ua.label",
    );
}

/**
 * Insert a new address row. address_id is IDENTITY — do not supply it.
 */
export async function createAddress(data: CreateAddressInput): Promise<number> {
  const [row] = await db("address").insert(data).returning("address_id");
  return row.address_id;
}

/**
 * Link an address to a user via user_address (composite PK: address_id, user_id)
 */
export async function addUserAddress(
  address_id: number,
  user_id: number,
  label: string | null = null,
): Promise<void> {
  await db("user_address").insert({
    address_id,
    user_id,
    is_default: false,
    label,
  });
}

/**
 * Update the address row itself (address_line, province_id, district_id, ward_id)
 */
export async function updateAddress(
  address_id: number,
  data: UpdateAddressInput,
): Promise<number> {
  const updates: Record<string, unknown> = {};
  if (data.address_line !== undefined) updates['address_line'] = data.address_line;
  if (data.province_id !== undefined) updates['province_id'] = data.province_id;
  if (data.district_id !== undefined) updates['district_id'] = data.district_id;
  if (data.ward_id !== undefined) updates['ward_id'] = data.ward_id;

  return db("address").where({ address_id }).update(updates);
}

/**
 * Remove the user_address link only (per FR-11 — address row itself is left alone)
 */
export async function removeUserAddress(
  address_id: number,
  user_id: number,
): Promise<number> {
  return db("user_address").where({ address_id, user_id }).del();
}

/**
 * Set one address as default for a user, clearing is_default on all others.
 */
export async function setDefaultAddress(
  address_id: number,
  user_id: number,
): Promise<number> {
  return db.transaction<number>(async (trx) => {
    await trx("user_address").where({ user_id }).update({ is_default: false });

    const updates: Record<string, unknown> = { is_default: true };
    const result = await trx("user_address")
      .where({ address_id, user_id })
      .update(updates);

    return result;
  });
}
