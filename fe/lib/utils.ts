import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPrice(amount: number, currency = "VND"): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Builds the full human-readable address string. address_line only ever
 * holds the house number/street (VARCHAR(20)) — ward/district/province
 * names must be concatenated on for it to mean anything on its own.
 * Segments are omitted rather than shown blank if not yet known (e.g. a
 * new address still being filled in on the checkout form).
 */
export function formatFullAddress(a: {
  address_line?: string | null;
  ward_name?: string | null;
  district_name?: string | null;
  province_name?: string | null;
}): string {
  return [a.address_line, a.ward_name, a.district_name, a.province_name]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join(", ");
}
