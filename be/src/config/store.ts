/**
 * config/store.ts
 *
 * Single-store scope (see ecommerce-api-plan.md scope note + §12
 * "Future Work — Multi-Store Expansion"): GHN only has one registered
 * shop, so the whole app currently operates against exactly one seeded
 * `store` row. Centralized here so it isn't duplicated as a magic `1`
 * across order.service.ts, product.model.ts, etc.
 *
 * 🔮 Future work (multi-store): replace usages of this constant with
 * real store-resolution logic (assignFulfillmentStores for orders,
 * cross-store rollups for availability) once a second store/GHN shop
 * exists — see §12.
 */
export const DEFAULT_STORE_ID = 1;
