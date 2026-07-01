import { ApiError } from "../utils/ApiError.js";
import * as CartModel from "../models/cart.model.js";
import * as PriceModel from "../models/product/product_price.model.js";
import * as ProductModel from "../models/product/product.model.js";

async function fetchUnitPrice(
  product_id: number,
  variant_id: number,
): Promise<number> {
  const price = await PriceModel.findPriceByVariant(product_id, variant_id);
  if (!price)
    throw new ApiError(
      422,
      `No price set for product ${product_id} variant ${variant_id}`,
    );
  return Number(price.base_price);
}

export async function getCart(user_id: number) {
  return CartModel.getCartWithItems(user_id);
}

export async function addItem(
  user_id: number,
  product_id: number,
  variant_id: number,
  quantity: number,
) {
  const variant = await ProductModel.findVariant(product_id, variant_id);
  if (!variant) throw new ApiError(404, "Product variant not found");

  const unit_price = await fetchUnitPrice(product_id, variant_id);
  const subtotal = unit_price * quantity;

  await CartModel.upsertCartItem({
    user_id,
    product_id,
    variant_id,
    quantity,
    unit_price,
    subtotal,
  });
  return CartModel.getCartWithItems(user_id);
}

export async function updateItem(
  user_id: number,
  product_id: number,
  variant_id: number,
  quantity: number,
) {
  const existing = await CartModel.findCartItem(
    user_id,
    product_id,
    variant_id,
  );
  if (!existing) throw new ApiError(404, "Item not in cart");

  const unit_price = await fetchUnitPrice(product_id, variant_id);
  await CartModel.updateCartItemQuantity(
    user_id,
    product_id,
    variant_id,
    quantity,
    unit_price,
  );
  return CartModel.getCartWithItems(user_id);
}

export async function removeItem(
  user_id: number,
  product_id: number,
  variant_id: number,
) {
  await CartModel.removeCartItem(user_id, product_id, variant_id);
  return CartModel.getCartWithItems(user_id);
}

export async function clearCart(user_id: number) {
  await CartModel.clearCart(user_id);
}

/**
 * Merge guest cart items into the server cart on login.
 * For each item: fetch current price, upsert (quantities accumulate).
 */
export async function mergeCart(
  user_id: number,
  guestItems: { product_id: number; variant_id: number; quantity: number }[],
) {
  for (const item of guestItems) {
    try {
      const unit_price = await fetchUnitPrice(item.product_id, item.variant_id);
      const subtotal = unit_price * item.quantity;
      await CartModel.upsertCartItem({
        user_id,
        ...item,
        unit_price,
        subtotal,
      });
    } catch {
      // Skip items that no longer have a price — non-fatal
    }
  }
  return CartModel.getCartWithItems(user_id);
}
