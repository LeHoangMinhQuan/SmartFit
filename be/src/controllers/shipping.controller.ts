import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import * as GhnService from "../services/ghn.service.js";

export const getAvailableServices = catchAsync(
  async (req: Request, res: Response) => {
    const { from_district_id, to_district_id } = req.body;
    const data = await GhnService.getAvailableServices(
      Number(from_district_id),
      Number(to_district_id),
    );
    res.json({ data });
  },
);

export const estimateFee = catchAsync(async (req: Request, res: Response) => {
  const data = await GhnService.estimateFee(req.body);
  res.json({ data });
});

export const trackOrder = catchAsync(async (req: Request, res: Response) => {
  const data = await GhnService.trackOrder(req.params['tracking_code'] as string);
  res.json({ data });
});

export const ghnWebhook = catchAsync(async (req: Request, res: Response) => {
  await GhnService.handleWebhook(req.body);
  res.json({ message: "OK" });
});

export const getProvinces = catchAsync(async (_req: Request, res: Response) => {
  const data = await GhnService.getProvinces();
  res.json({ data });
});

export const getDistricts = catchAsync(async (req: Request, res: Response) => {
  const data = await GhnService.getDistricts(Number(req.params['province_id']));
  res.json({ data });
});

export const getWards = catchAsync(async (req: Request, res: Response) => {
  const data = await GhnService.getWards(Number(req.params['district_id']));
  res.json({ data });
});
