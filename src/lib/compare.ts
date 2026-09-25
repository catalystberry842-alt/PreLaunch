import { round1 } from "./format.ts";
import { canonicalizePreStockId } from "./prestock-meta.ts";
import type { Basket, BasketHolding, PreStock } from "./types.ts";
import type { PortfolioPosition, PortfolioSnapshot } from "../types/portfolio.ts";

export type CompareSide = "both" | "portfolio" | "basket";

export type CompareRow = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  initials: string;
  portfolioPercent: number;
  basketPercent: number;
  difference: number;
  portfolioValue: number;
  inPortfolio: boolean;
  inBasket: boolean;
  side: CompareSide;
};

export type CompareResult = {
  rows: CompareRow[];
  overlap: CompareRow[];
  portfolioOnly: CompareRow[];
  basketOnly: CompareRow[];
  portfolioValue: number;
  insights: string[];
};

function findStock(stocks: PreStock[], id: string) {
  const canonical = canonicalizePreStockId(id);
  return stocks.find(
    (stock) => stock.id === canonical || stock.symbol === canonical,
  );
}

function initialsFor(symbol: string, name: string) {
  const fromSymbol = symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 2);
  if (fromSymbol) return fromSymbol.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "—";
}

export function portfolioHoldingsFromSnapshot(
  snapshot: PortfolioSnapshot,
  stocks: PreStock[],
): BasketHolding[] {
  const total = snapshot.totalValue;
  // Positions without a current price have no weight; they are excluded
  // rather than simulated at a fabricated 0%.
  const holdings: BasketHolding[] = [];
  for (const position of snapshot.positions) {
    const value = position.value;
    if (value == null || !Number.isFinite(value) || value <= 0 || total <= 0) continue;
    const id = canonicalizePreStockId(position.symbol);
    const stock = findStock(stocks, id) ?? null;
    holdings.push({
      preStockId: stock?.id ?? id,
      allocation: round1((value / total) * 100),
      stock,
    });
  }
  return holdings;
}

export function comparePortfolioToBasket(
  snapshot: PortfolioSnapshot,
  basket: Basket,
  stocks: PreStock[],
): CompareResult {
  const totalValue = Number.isFinite(snapshot.totalValue)
    ? snapshot.totalValue
    : 0;

  const portfolio = new Map<string, PortfolioPosition>();
  for (const position of snapshot.positions) {
    const id = canonicalizePreStockId(position.symbol);
    if (!id) continue;
    const existing = portfolio.get(id);
    if (!existing) {
      portfolio.set(id, position);
      continue;
    }
    portfolio.set(id, {
      ...existing,
      quantity: existing.quantity + position.quantity,
      value:
        existing.value == null && position.value == null
          ? null
          : (existing.value ?? 0) + (position.value ?? 0),
    });
  }

  const basketWeights = new Map<string, number>();
  for (const item of basket.constituents) {
    const id = canonicalizePreStockId(item.preStockId);
    if (!id) continue;
    basketWeights.set(id, (basketWeights.get(id) ?? 0) + item.allocation);
  }

  const ids = new Set([...portfolio.keys(), ...basketWeights.keys()]);
  const rows: CompareRow[] = [];

  for (const id of ids) {
    const position = portfolio.get(id);
    const stock = findStock(stocks, id);
    const positionValue = position?.value;
    const portfolioValue =
      positionValue != null && Number.isFinite(positionValue) ? positionValue : 0;
    const portfolioPercent =
      totalValue > 0 ? round1((portfolioValue / totalValue) * 100) : 0;
    const basketPercent = round1(basketWeights.get(id) ?? 0);
    const inPortfolio = Boolean(position) && portfolioValue > 0;
    const inBasket = basketPercent > 0;
    // Held but unpriced and not in the basket: nothing to compare honestly.
    if (!inPortfolio && !inBasket) continue;
    const side: CompareSide =
      inPortfolio && inBasket
        ? "both"
        : inPortfolio
          ? "portfolio"
          : "basket";
    const name = stock?.name ?? position?.name ?? id;
    const symbol = stock?.symbol ?? position?.symbol ?? id;
    rows.push({
      id,
      symbol,
      name,
      image: stock?.image ?? position?.image ?? "",
      initials:
        stock?.initials ??
        position?.initials ??
        initialsFor(symbol, name),
      portfolioPercent,
      basketPercent,
      difference: round1(portfolioPercent - basketPercent),
      portfolioValue,
      inPortfolio,
      inBasket,
      side,
    });
  }

  rows.sort((a, b) => {
    if (a.side !== b.side) {
      const order = { both: 0, portfolio: 1, basket: 2 };
      return order[a.side] - order[b.side];
    }
    return Math.abs(b.difference) - Math.abs(a.difference) || a.symbol.localeCompare(b.symbol);
  });

  const overlap = rows.filter((row) => row.side === "both");
  const portfolioOnly = rows.filter((row) => row.side === "portfolio");
  const basketOnly = rows.filter((row) => row.side === "basket");

  return {
    rows,
    overlap,
    portfolioOnly,
    basketOnly,
    portfolioValue: totalValue,
    insights: buildInsights(overlap, portfolioOnly, basketOnly),
  };
}

function buildInsights(
  overlap: CompareRow[],
  portfolioOnly: CompareRow[],
  basketOnly: CompareRow[],
) {
  const lines: string[] = [];
  const overlapByGap = [...overlap].sort(
    (a, b) => Math.abs(b.difference) - Math.abs(a.difference),
  );
  for (const row of overlapByGap) {
    if (row.difference === 0) continue;
    lines.push(
      `You hold ${row.portfolioPercent}% ${row.symbol} while this basket allocates ${row.basketPercent}%.`,
    );
    if (lines.length >= 4) break;
  }
  for (const row of portfolioOnly) {
    lines.push(
      `${row.symbol} is in your portfolio at ${row.portfolioPercent}% and is not in this basket.`,
    );
    if (lines.length >= 6) break;
  }
  for (const row of basketOnly) {
    lines.push(
      `${row.symbol} is in this basket at ${row.basketPercent}% and is not in your portfolio.`,
    );
    if (lines.length >= 8) break;
  }
  return lines;
}
