import type { BasketConstituent } from "@/lib/types";

export function formatQuantity(value: number) {
  if (!Number.isFinite(value)) return "—";
  const digits = value >= 100 ? 2 : value >= 1 ? 4 : 6;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedUsd(value: number) {
  const body = formatPrice(Math.abs(value));
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

export function formatCostBasis(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "Cost basis unavailable";
  return formatPrice(value);
}

export function formatCompact(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const format = (n: number, suffix: string) => {
    const rounded = Math.round(n * 10) / 10;
    const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${sign}$${body}${suffix}`;
  };
  if (abs >= 1e12) return format(abs / 1e12, "T");
  if (abs >= 1e9) return format(abs / 1e9, "B");
  if (abs >= 1e6) return format(abs / 1e6, "M");
  if (abs >= 1e3) return format(abs / 1e3, "K");
  return `${sign}$${Math.round(abs)}`;
}

export function formatSupply(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAddress(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function percentFromBase(value: number, base: number) {
  if (!Number.isFinite(value) || !Number.isFinite(base) || base === 0) {
    return null;
  }
  return ((value - base) / base) * 100;
}

export function formatPercent(value: number, digits = 1) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function allocationTotal(
  value: BasketConstituent[] | Record<string, number>,
) {
  const sum = Array.isArray(value)
    ? value.reduce((acc, item) => acc + item.allocation, 0)
    : Object.values(value).reduce((acc, item) => acc + item, 0);
  return round1(sum);
}

export function setAllocation(
  allocations: Record<string, number>,
  id: string,
  next: number,
) {
  const others = allocationTotal(allocations) - (allocations[id] ?? 0);
  const max = Math.max(0, round1(100 - others));
  const clamped = Math.min(Math.max(0, round1(next)), max);
  return { ...allocations, [id]: clamped };
}

export function equalAllocations(ids: string[]) {
  if (ids.length === 0) return {} as Record<string, number>;
  const base = round1(Math.floor(1000 / ids.length) / 10);
  const result: Record<string, number> = {};
  let used = 0;
  ids.forEach((id, index) => {
    if (index === ids.length - 1) {
      result[id] = round1(100 - used);
    } else {
      result[id] = base;
      used = round1(used + base);
    }
  });
  return result;
}

export const ALLOCATION_COLORS = [
  "var(--alloc-1)",
  "var(--alloc-2)",
  "var(--alloc-3)",
  "var(--alloc-4)",
  "var(--alloc-5)",
  "var(--alloc-6)",
  "var(--alloc-7)",
  "var(--alloc-8)",
];
