import { ApiError } from "../utils/ApiError.js";
import * as CartModel from "../models/cart.model.js";
import * as PriceModel from "../models/product/product_price.model.js";
import * as ProductModel from "../models/product/product.model.js";
import * as StoreProductModel from "../models/store_product.model.js";
import { DEFAULT_STORE_ID } from "../config/store.js";

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

/**
 * BUG FIX: previously neither addItem nor updateItem checked available
 * stock at all — a customer (or the chatbot's add_to_cart tool) could add
 * any quantity, with the only enforcement happening at final order
 * placement (order.service.ts's transaction), well after address/
 * shipping/payment had already been selected. This throws the same
 * ApiError(409) shape order creation already uses, just far earlier in
 * the flow, so both the cart UI and the chatbot ("if a tool call fails,
 * tell the customer what went wrong") can surface it immediately.
 *
 * Best-effort, not a hold: like the rest of this cart implementation,
 * this doesn't reserve stock — two customers can still both pass this
 * check for the last unit and only one will actually get it at order
 * time (order.service.ts's transaction is still the real, race-free
 * guarantee). This exists to give honest feedback at add-time, not to
 * replace that guarantee.
 */
async function assertStockAvailable(
  product_id: number,
  variant_id: number,
  requestedTotalQuantity: number,
): Promise<void> {
  const available = await StoreProductModel.findQuantity(
    product_id,
    variant_id,
    DEFAULT_STORE_ID,
  );
  if (requestedTotalQuantity > available) {
    throw new ApiError(
      409,
      available > 0
        ? `Only ${available} left in stock for this item.`
        : "This item is currently out of stock.",
    );
  }
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

  const existing = await CartModel.findCartItem(
    user_id,
    product_id,
    variant_id,
  );
  await assertStockAvailable(
    product_id,
    variant_id,
    (existing?.quantity ?? 0) + quantity,
  );

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

  await assertStockAvailable(product_id, variant_id, quantity);

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
      // BUG FIX: a guest cart is built up client-side with no stock
      // checks at all (it's just localStorage), so this was the one
      // remaining path where an over-limit quantity could reach the
      // server cart untouched. Clamp to whatever's actually available
      // rather than rejecting the whole merge — a guest who added 5 of
      // something now down to 2 in stock should still get the 2, not
      // lose the item entirely over a login-time race they had no way
      // to see coming.
      const existing = await CartModel.findCartItem(
        user_id,
        item.product_id,
        item.variant_id,
      );
      const available = await StoreProductModel.findQuantity(
        item.product_id,
        item.variant_id,
        DEFAULT_STORE_ID,
      );
      const alreadyInCart = existing?.quantity ?? 0;
      const room = Math.max(0, available - alreadyInCart);
      const quantity = Math.min(item.quantity, room);
      if (quantity <= 0) continue;

      const subtotal = unit_price * quantity;
      await CartModel.upsertCartItem({
        user_id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity,
        unit_price,
        subtotal,
      });
    } catch {
      // Skip items that no longer have a price — non-fatal
    }
  }
  return CartModel.getCartWithItems(user_id);
}