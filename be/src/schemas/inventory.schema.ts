// schemas/inventory.schema.ts (new file)
import { z } from "zod";

export const recordImportSchema = z.object({
  body: z.object({
    supplier_id: z.number().int().positive(),
    product_id: z.number().int().positive(),
    variant_id: z.number().int().positive(),
    store_id: z.number().int().positive(),
    quantity: z.number().int().positive(),
    import_date: z.string().datetime().optional(),
  }),
});

export const adjustQuantitySchema = z.object({
  params: z.object({
    product_id: z.coerce.number().int().positive(),
    variant_id: z.coerce.number().int().positive(),
    store_id: z.coerce.number().int().positive(),
  }),
  body: z.object({
    quantity: z.number().int().nonnegative(), // absolute set — 0 is valid (out of stock), negative is not
  }),
});
