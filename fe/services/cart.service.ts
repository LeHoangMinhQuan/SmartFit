import api from "../lib/axios";
import type { CartItem } from "../interfaces";

interface CartItemKey {
  product_id: number;
  variant_id: number;
}

interface AddItemBody extends CartItemKey {
  quantity: number;
}

// GET /cart, POST /cart/items, PATCH /cart/items, DELETE /cart/items, and
// POST /cart/merge all return the SAME full-cart envelope — not just the
// mutated item — so every mutation below gives the caller an authoritative,
// up-to-date `total` without a second round trip to GET /cart.
export interface CartData {
  items: CartItem[];
  total: number;
}

interface CartEnvelope {
  data: CartData;
}

// Postgres NUMERIC columns (unit_price, subtotal) serialize as JSON strings
// (e.g. "299000.00"), not numbers — even though CartItem declares them as
// `number`. Left uncoerced, `cartItems.reduce((s, i) => s + i.subtotal, 0)`
// silently does string concatenation instead of addition. Normalize once,
// here, so every consumer can trust CartItem.unit_price/subtotal are real
// numbers as declared. `total` itself is already a real number — the
// backend computes it in JS (`Number(item.subtotal)` summed), so it's never
// quoted — no coercion needed there.
function normalizeCart(cart: CartData): CartData {
  return {
    ...cart,
    items: cart.items.map((i) => ({
      ...i,
      unit_price: Number(i.unit_price),
      subtotal: Number(i.subtotal),
    })),
  };
}

export const cartService = {
  getCart: () =>
    api.get<CartEnvelope>("/cart").then((r) => normalizeCart(r.data.data)),

  // quantity here is the quantity being ADDED, not the new total
  addItem: (body: AddItemBody) =>
    api
      .post<CartEnvelope>("/cart/items", body)
      .then((r) => normalizeCart(r.data.data)),

  // quantity: new desired quantity (not a delta)
  updateItem: (body: AddItemBody) =>
    api
      .patch<CartEnvelope>("/cart/items", body)
      .then((r) => normalizeCart(r.data.data)),

  // DELETE with a body — Axios requires { data: body } as config
  removeItem: (body: CartItemKey) =>
    api
      .delete<CartEnvelope>("/cart/items", { data: body })
      .then((r) => normalizeCart(r.data.data)),

  clearCart: () => api.delete("/cart").then((r) => r.data),

  mergeCart: (items: AddItemBody[]) =>
    api
      .post<CartEnvelope>("/cart/merge", { items })
      .then((r) => normalizeCart(r.data.data)),
};
