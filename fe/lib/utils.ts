import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPrice(amount: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(
    amount,
  );
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN");
}
