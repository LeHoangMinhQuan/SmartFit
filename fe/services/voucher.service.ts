import api from "../lib/axios";
import type { Voucher } from "../interfaces";

export const voucherService = {
  // Validates code eligibility (dates, usage limit, min amount).
  // Returns the voucher details on success so the UI can display the discount.
  validateVoucher: (code: string) =>
    api.post<Voucher>("/api/vouchers/validate", { code }).then((r) => r.data),
};
