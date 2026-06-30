import db from "../config/db.js";

const CART_ID = 1; // one cart per user

// ─── Cart ─────────────────────────────────────────────────────────────────────

export async function findOrCreateCart(user_id: number) {
  let cart = await db("cart").where({ user_id, cart_id: CART_ID }).first();
  if (!cart) {
    await db("cart").insert({ user_id, cart_id: CART_ID });
    cart = await db("cart").where({ user_id, cart_id: CART_ID }).first();
  }
  return cart;
}

export async function getCartWithItems(user_id: number) {
  await findOrCreateCart(user_id);

  const items = await db("cart_item as ci")
    .join("product as p", "ci.product_id", "p.product_id")
    .join("product_variant as pv", function () {
      this.on("ci.product_id", "pv.product_id").andOn(
        "ci.variant_id",
        "pv.variant_id",
      );
    })
    .leftJoin("product_image as pi", function () {
      this.on("ci.product_id", "pi.product_id").andOn(
        "ci.variant_id",
        "pi.variant_id",
      );
    })
    .where({ "ci.user_id": user_id, "ci.cart_id": CART_ID })
    .select(
      "ci.product_id",
      "ci.variant_id",
      "ci.quantity",
      "ci.unit_price",
      "ci.subtotal",
      "p.name as product_name",
      "pv.name as variant_name",
      "pi.s3_url as image_url",
    )
    .distinct("ci.product_id", "ci.variant_id");

  const total = items.reduce(
    (sum: number, item: any) => sum + Number(item.subtotal),
    0,
  );
  return { items, total };
}

// ─── Cart Item ────────────────────────────────────────────────────────────────

export async function findCartItem(
  user_id: number,
  product_id: number,
  variant_id: number,
) {
  return db("cart_item")
    .where({ user_id, cart_id: CART_ID, product_id, variant_id })
    .first();
}

export async function upsertCartItem(data: {
  user_id: number;
  product_id: number;
  variant_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
}) {
  const existing = await findCartItem(
    data.user_id,
    data.product_id,
    data.variant_id,
  );

  if (!existing) {
    return db("cart_item").insert({ ...data, cart_id: CART_ID });
  }

  const newQty = existing.quantity + data.quantity;
  const newSubtotal = data.unit_price * newQty;
  return db("cart_item")
    .where({
      user_id: data.user_id,
      cart_id: CART_ID,
      product_id: data.product_id,
      variant_id: data.variant_id,
    })
    .update({
      quantity: newQty,
      unit_price: data.unit_price,
      subtotal: newSubtotal,
    });
}

export async function updateCartItemQuantity(
  user_id: number,
  product_id: number,
  variant_id: number,
  quantity: number,
  unit_price: number,
) {
  const subtotal = unit_price * quantity;
  return db("cart_item")
    .where({ user_id, cart_id: CART_ID, product_id, variant_id })
    .update({ quantity, subtotal, unit_price });
}

export async function removeCartItem(
  user_id: number,
  product_id: number,
  variant_id: number,
) {
  return db("cart_item")
    .where({ user_id, cart_id: CART_ID, product_id, variant_id })
    .delete();
}

export async function clearCart(user_id: number) {
  return db("cart_item").where({ user_id, cart_id: CART_ID }).delete();
}

export async function getCartItems(user_id: number) {
  return db("cart_item").where({ user_id, cart_id: CART_ID });
}
