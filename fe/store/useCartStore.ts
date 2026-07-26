import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "../interfaces";

interface CartStore {
  items: CartItem[];
  total: number;
  setCartData: (items: CartItem[], total: number) => void;
  setItems: (items: CartItem[]) => void;
  addItem: (item: CartItem) => void;
  updateItem: (
    product_id: number,
    variant_id: number,
    quantity: number,
  ) => void;
  removeItem: (product_id: number, variant_id: number) => void;
  clearItems: () => void;
  totalCount: () => number;
}

function sumSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + Number(i.subtotal), 0);
} // <-- The missing closing brace was added here

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,

      setItems: (items) => set({ items, total: sumSubtotal(items) }),

      setCartData: (items, total) => set({ items, total }),

      addItem: (item) =>
        set((s) => {
          const exists = s.items.find(
            (i) =>
              i.product_id === item.product_id &&
              i.variant_id === item.variant_id,
          );
          const items = exists
            ? s.items.map((i) =>
                i.product_id === item.product_id &&
                i.variant_id === item.variant_id
                  ? {
                      ...i,
                      quantity: i.quantity + item.quantity,
                      subtotal: i.unit_price * (i.quantity + item.quantity),
                    }
                  : i,
              )
            : [...s.items, item];
          return { items, total: sumSubtotal(items) };
        }),

      updateItem: (product_id, variant_id, quantity) =>
        set((s) => {
          const items = s.items.map((i) =>
            i.product_id === product_id && i.variant_id === variant_id
              ? { ...i, quantity, subtotal: i.unit_price * quantity }
              : i,
          );
          return { items, total: sumSubtotal(items) };
        }),

      removeItem: (product_id, variant_id) =>
        set((s) => {
          const items = s.items.filter(
            (i) =>
              !(i.product_id === product_id && i.variant_id === variant_id),
          );
          return { items, total: sumSubtotal(items) };
        }),

      clearItems: () => set({ items: [], total: 0 }),

      totalCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "cart", // localStorage key
      partialize: (state) => ({ items: state.items, total: state.total }),
    },
  ),
);
