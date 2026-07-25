import api from "../lib/axios";
import type { CartItem } from "../interfaces";

interface CartItemKey {
  product_id: number;
  variant_id: number;
}

interface AddItemBody extends CartItemKey {
  quantity: number;
}

// GET /cart and POST /cart/merge both return the full cart envelope:
// { data: { items: CartItem[], total: number } }
interface CartEnvelope {
  data: {
    items: CartItem[];
    total: number;
  };
}

export const cartService = {
  getCart: () => api.get<CartEnvelope>("/cart").then((r) => r.data.data.items),

  addItem: (body: AddItemBody) =>
    api.post<{ data: CartItem }>("/cart/items", body).then((r) => r.data.data),

  // quantity: new desired quantity (not a delta)
  updateItem: (body: AddItemBody) =>
    api.patch<{ data: CartItem }>("/cart/items", body).then((r) => r.data.data),

  // DELETE with a body — Axios requires { data: body } as config
  removeItem: (body: CartItemKey) =>
    api.delete("/cart/items", { data: body }).then((r) => r.data),

  clearCart: () => api.delete("/cart").then((r) => r.data),

  mergeCart: (items: AddItemBody[]) =>
    api
      .post<CartEnvelope>("/cart/merge", { items })
      .then((r) => r.data.data.items),
};
