import { create } from "zustand";
import type { WishlistItem } from "../interfaces";

interface WishlistStore {
  items: WishlistItem[];
  setItems: (items: WishlistItem[]) => void;
  add: (item: WishlistItem) => void;
  remove: (product_id: number, variant_id: number) => void;
}

export const useWishlistStore = create<WishlistStore>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  add: (item) => set((s) => ({ items: [...s.items, item] })),
  remove: (product_id, variant_id) =>
    set((s) => ({
      items: s.items.filter(
        (i) => !(i.product_id === product_id && i.variant_id === variant_id),
      ),
    })),
}));
