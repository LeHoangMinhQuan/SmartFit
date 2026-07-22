import { z } from "zod";

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50), // matches supplier.name VARCHAR(50) — confirm length against your actual column
  }),
});

export const updateSupplierSchema = z.object({
  params: z.object({ supplier_id: z.coerce.number().int().positive() }),
  body: z.object({
    name: z.string().min(1).max(50),
  }),
});

export const supplierParamsSchema = z.object({
  params: z.object({ supplier_id: z.coerce.number().int().positive() }),
});
