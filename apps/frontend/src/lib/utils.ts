import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCompactNumber(value: number, suffix = "") {
  return `${Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value)}${suffix}`;
}

export function formatCurrency(value: number) {
  return Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}
