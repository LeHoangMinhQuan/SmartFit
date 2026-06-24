import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  color: string;
  size: string;
  quantity: number;
  imageUrl: string;
}

interface CartState {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string, color: string, size: string) => void;
  updateQuantity: (
    id: string,
    color: string,
    size: string,
    quantity: number,
  ) => void;
  getCartTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addToCart: (newItem) =>
        set((state) => {
          // Check if item with same id, size, and color already exists
          const existingItem = state.items.find(
            (item) =>
              item.id === newItem.id &&
              item.color === newItem.color &&
              item.size === newItem.size,
          );

          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item === existingItem
                  ? { ...item, quantity: item.quantity + newItem.quantity }
                  : item,
              ),
            };
          }
          return { items: [...state.items, newItem] };
        }),

      removeFromCart: (id, color, size) =>
        set((state) => ({
          items: state.items.filter(
            (item) =>
              !(item.id === id && item.color === color && item.size === size),
          ),
        })),

      updateQuantity: (id, color, size, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id && item.color === color && item.size === size
              ? { ...item, quantity: Math.max(1, quantity) }
              : item,
          ),
        })),

      getCartTotal: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0,
        );
      },
      setItems: (items: CartItem[]) => set({ items }),
    }),
    {
      name: "shopco-cart-storage", // saves to localStorage so cart persists on refresh
    },
  ),
);
