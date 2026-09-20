import type { Category } from "@/lib/types";

/**
 * PreLaunch-only metadata. The PreStocks API does not provide categories.
 * Keys are API symbols.
 */
export const PRESTOCK_CATEGORIES: Record<string, Category> = {
  OPENAI: "AI",
  ANTHROPIC: "AI",
  ANDURIL: "Defense",
  FIGUREAI: "Robotics",
  NEURALINK: "Consumer",
  KALSHI: "Fintech",
  POLYMARKET: "Fintech",
  SPACEX: "Space",
};

export const PRESTOCK_ID_ALIASES: Record<string, string> = {
  openai: "OPENAI",
  oai: "OPENAI",
  anthropic: "ANTHROPIC",
  anth: "ANTHROPIC",
  anduril: "ANDURIL",
  figure: "FIGUREAI",
  "figure-ai": "FIGUREAI",
  figureai: "FIGUREAI",
  kalshi: "KALSHI",
  spacex: "SPACEX",
  neuralink: "NEURALINK",
  polymarket: "POLYMARKET",
};

export function canonicalizePreStockId(id: string) {
  const trimmed = id.trim();
  if (!trimmed) return trimmed;
  return PRESTOCK_ID_ALIASES[trimmed.toLowerCase()] ?? trimmed.toUpperCase();
}

export function categoryForSymbol(symbol: string): Category {
  return PRESTOCK_CATEGORIES[canonicalizePreStockId(symbol)] ?? "Infrastructure";
}

export function initialsFromName(name: string) {
  const words = name
    .replace(/PreStocks/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "PS";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export function displayNameFromApi(name: string) {
  return name.replace(/\s*PreStocks\s*$/i, "").trim() || name;
}
