import { create } from "zustand";
import type { WishlistItem } from "../interfaces";

interface WishlistStore {
  items: WishlistItem[];
  setItems: (items: WishlistItem[]) => void;
  addItem: (item: WishlistItem) => void;
  removeItem: (product_id: number, variant_id: number) => void;
  isWishlisted: (product_id: number, variant_id: number) => boolean;
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
  items: [],

  setItems: (items) => set({ items }),

  addItem: (item) =>
    set((s) => {
      const exists = s.items.find(
        (i) =>
          i.product_id === item.product_id && i.variant_id === item.variant_id,
      );
      return exists ? s : { items: [...s.items, item] };
    }),

  removeItem: (product_id, variant_id) =>
    set((s) => ({
      items: s.items.filter(
        (i) => !(i.product_id === product_id && i.variant_id === variant_id),
      ),
    })),

  isWishlisted: (product_id, variant_id) =>
    get().items.some(
      (i) => i.product_id === product_id && i.variant_id === variant_id,
    ),
}));
