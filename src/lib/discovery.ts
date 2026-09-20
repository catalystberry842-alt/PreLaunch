import { matchesBasketText } from "./ranking.ts";
import type {
  Basket,
  BasketSort,
  Category,
  ConstituentCountFilter,
  FilterCategory,
} from "./types.ts";

/** Theme explorer order. "Other" stays a filter chip, not a destination card. */
export const DISCOVER_THEMES = [
  "AI",
  "Defense",
  "Robotics",
  "Fintech",
  "Space",
  "Infrastructure",
  "Consumer",
  "Private Markets",
] as const satisfies readonly Category[];

/**
 * Curated local featured set. This is PreLaunch metadata, not a claim these
 * baskets are the best or have the strongest returns.
 */
export const FEATURED_BASKET_IDS = [
  "ai-infrastructure",
  "future-of-defense",
  "next-gen-fintech",
] as const;

const FEATURED_ID_SET = new Set<string>(FEATURED_BASKET_IDS);

export function getFeaturedBaskets(items: Basket[], limit = 3): Basket[] {
  const byId = new Map(items.map((basket) => [basket.id, basket]));
  const curated = FEATURED_BASKET_IDS.map((id) => byId.get(id)).filter(
    (basket): basket is Basket => Boolean(basket),
  );
  const extras = items.filter(
    (basket) => basket.featured && !FEATURED_ID_SET.has(basket.id),
  );
  return [...curated, ...extras].slice(0, limit);
}

function engagementScore(basket: Basket) {
  return (basket.views ?? 0) * 2 + (basket.saves ?? 0) * 5;
}

export function getTrendingBaskets(items: Basket[], limit = 4): Basket[] {
  return [...items]
    .sort((a, b) => {
      const delta = engagementScore(b) - engagementScore(a);
      return delta || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function getNewestBaskets(items: Basket[], limit = 4): Basket[] {
  return sortDiscoveryBaskets(items, "newest").slice(0, limit);
}

export function constituentSearchExtra(
  basket: Basket,
  resolve: (
    id: string,
  ) => { name?: string; symbol?: string; officialName?: string } | undefined,
) {
  return basket.constituents
    .map((item) => {
      const stock = resolve(item.preStockId);
      if (!stock) return item.preStockId;
      return [item.preStockId, stock.name, stock.symbol, stock.officialName]
        .filter(Boolean)
        .join(" ");
    })
    .join(" ");
}

export function searchBaskets(
  items: Basket[],
  query: string,
  extraFor?: (basket: Basket) => string,
): Basket[] {
  return items.filter((basket) =>
    matchesBasketText(basket, query, extraFor?.(basket) ?? ""),
  );
}

export function matchesConstituentCount(
  count: number,
  names: ConstituentCountFilter = "any",
) {
  if (names === "any") return true;
  if (names === "2") return count === 2;
  if (names === "3") return count === 3;
  return count >= 4;
}

export function filterBaskets(
  items: Basket[],
  opts: {
    category?: FilterCategory;
    names?: ConstituentCountFilter;
    sort?: BasketSort;
  } = {},
): Basket[] {
  const category = opts.category ?? "All";
  const names = opts.names ?? "any";
  const sort = opts.sort ?? "newest";
  const filtered = items.filter((basket) => {
    if (category !== "All" && basket.category !== category) return false;
    return matchesConstituentCount(basket.constituents.length, names);
  });
  return sortDiscoveryBaskets(filtered, sort);
}

function sortDiscoveryBaskets(items: Basket[], sort: BasketSort) {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === "newest") {
      return (
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        a.name.localeCompare(b.name)
      );
    }
    if (sort === "views") {
      return (b.views ?? 0) - (a.views ?? 0) || a.name.localeCompare(b.name);
    }
    if (sort === "saves") {
      return (b.saves ?? 0) - (a.saves ?? 0) || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
  return copy;
}
