import api from "../lib/axios";
import type { WishlistItem } from "../interfaces";

export const wishlistService = {
  // Returns active items only (deleted_at IS NULL on the server), joined
  // with product/variant name, price, and a preview image.
  // Backend wraps this in { data: [...] } (see user.controller.ts
  // getWishlist) — unwrap with r.data.data, not r.data.
  getWishlist: () =>
    api
      .get<{ data: WishlistItem[] }>("/users/me/wishlist")
      .then((r) => r.data.data),

  // Upsert — server clears deleted_at if item was previously soft-deleted.
  // NOTE: the backend only returns { data: { message } } here, not the
  // created wishlist item (see user.controller.ts addToWishlist) — there's
  // no product/variant name, price, or image to hand back. Callers that
  // need an optimistic WishlistItem for local state must construct one
  // themselves from data they already have (see product/[id]/page.tsx).
  addToWishlist: (body: { product_id: number; variant_id: number }) =>
    api
      .post<{ data: { message: string } }>("/users/me/wishlist", body)
      .then((r) => r.data.data),

  // Soft-delete on the server (sets deleted_at = NOW())
  // DELETE with path params — no body needed. 204 No Content.
  removeFromWishlist: (product_id: number, variant_id: number) =>
    api
      .delete(`/users/me/wishlist/${product_id}/${variant_id}`)
      .then((r) => r.data),
};
