import {
  categoryForSymbol,
  displayNameFromApi,
  initialsFromName,
} from "@/lib/prestock-meta";
import type { PreStock, PreStocksApiItem } from "@/lib/types";

export const PRESTOCKS_API_URL = "https://prestocks.com/api/prestocks";

const CACHE_MS = 60_000;

let cache: { at: number; data: PreStock[] } | null = null;

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function isPreStocksApiItem(value: unknown): value is PreStocksApiItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.symbol === "string" && typeof item.name === "string";
}

export function normalizePreStock(item: PreStocksApiItem): PreStock {
  const symbol = item.symbol.trim().toUpperCase();
  const officialName = item.name.trim();
  const name = displayNameFromApi(officialName);
  return {
    id: symbol,
    name,
    officialName,
    symbol,
    category: categoryForSymbol(symbol),
    initials: initialsFromName(name),
    image: asString(item.image),
    description: asString(item.description),
    externalUrl: asString(item.external_url),
    contractAddress: asString(item.contract_address),
    markPrice: asNumber(item.markPrice),
    markValuation: asNumber(item.markValuation),
    tokenPrice: asNumber(item.tokenPrice),
    impliedValuation: asNumber(item.impliedValuation),
    supply: asNumber(item.supply),
  };
}

export async function fetchPreStocks(options?: {
  fresh?: boolean;
}): Promise<PreStock[]> {
  if (!options?.fresh && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }

  const response = await fetch(PRESTOCKS_API_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`PreStocks catalog unavailable (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("PreStocks catalog returned an unexpected shape");
  }

  const data = payload.filter(isPreStocksApiItem).map(normalizePreStock);
  if (data.length === 0) {
    throw new Error("PreStocks catalog is empty");
  }

  cache = { at: Date.now(), data };
  return data;
}
