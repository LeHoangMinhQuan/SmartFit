import api from "../lib/axios";
import type { WishlistItem } from "../interfaces";

export const wishlistService = {
  // Returns active items only (deleted_at IS NULL on the server)
  getWishlist: () =>
    api.get<WishlistItem[]>("/users/me/wishlist").then((r) => r.data),

  // Upsert — server clears deleted_at if item was previously soft-deleted
  addToWishlist: (body: { product_id: number; variant_id: number }) =>
    api.post<WishlistItem>("/users/me/wishlist", body).then((r) => r.data),

  // Soft-delete on the server (sets deleted_at = NOW())
  // DELETE with path params — no body needed
  removeFromWishlist: (product_id: number, variant_id: number) =>
    api
      .delete(`/users/me/wishlist/${product_id}/${variant_id}`)
      .then((r) => r.data),
};
