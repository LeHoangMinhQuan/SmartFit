import api from "../lib/axios";
import type { CartItem } from "../interfaces";

interface CartItemKey {
  product_id: number;
  variant_id: number;
}

interface AddItemBody extends CartItemKey {
  quantity: number;
}

export const cartService = {
  getCart: () => api.get<CartItem[]>("/cart").then((r) => r.data),

  addItem: (body: AddItemBody) =>
    api.post<CartItem>("/cart/items", body).then((r) => r.data),

  // quantity: new desired quantity (not a delta)
  updateItem: (body: AddItemBody) =>
    api.patch<CartItem>("/cart/items", body).then((r) => r.data),

  // DELETE with a body — Axios requires { data: body } as config
  removeItem: (body: CartItemKey) =>
    api.delete("/cart/items", { data: body }).then((r) => r.data),

  clearCart: () => api.delete("/cart").then((r) => r.data),

  mergeCart: (items: AddItemBody[]) =>
    api.post<CartItem[]>("/cart/merge", { items }).then((r) => r.data),
};
