import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as SupplierService from "../services/supplier.service.js";

export const listSuppliers = catchAsync(
  async (_req: Request, res: Response) => {
    const suppliers = await SupplierService.listSuppliers();
    res.json({ data: suppliers });
  },
);

export const getSupplier = catchAsync(async (req: Request, res: Response) => {
  const supplier = await SupplierService.getSupplier(
    Number(req.params["supplier_id"]),
  );
  res.json({ data: supplier });
});

export const createSupplier = catchAsync(
  async (req: Request, res: Response) => {
    const result = await SupplierService.createSupplier(req.body.name);
    res.status(201).json({ data: result });
  },
);

export const updateSupplier = catchAsync(
  async (req: Request, res: Response) => {
    await SupplierService.updateSupplier(
      Number(req.params["supplier_id"]),
      req.body.name,
    );
    res.json({ data: { message: "Supplier updated" } });
  },
);

export const deleteSupplier = catchAsync(
  async (req: Request, res: Response) => {
    await SupplierService.deleteSupplier(Number(req.params["supplier_id"]));
    res.status(204).send();
  },
);
