import { percentFromBase, round1 } from "./format.ts";
import type { PreStock } from "./types.ts";

/**
 * Token price vs mark price, in percent, from the PreStocks catalog:
 * (tokenPrice − markPrice) ÷ markPrice × 100. Positive = the token trades at
 * a premium to the mark; negative = a discount. Null unless both prices are
 * finite and positive (the catalog normalizer turns missing values into 0).
 */
export function tokenVsMark(stock: Pick<PreStock, "tokenPrice" | "markPrice">): number | null {
  if (!(stock.tokenPrice > 0) || !(stock.markPrice > 0)) return null;
  return percentFromBase(stock.tokenPrice, stock.markPrice);
}

/** Implied valuation vs mark valuation, in percent; null unless both are positive. */
export function impliedVsMark(
  stock: Pick<PreStock, "impliedValuation" | "markValuation">,
): number | null {
  if (!(stock.impliedValuation > 0) || !(stock.markValuation > 0)) return null;
  return percentFromBase(stock.impliedValuation, stock.markValuation);
}

export type BasketPremium = {
  /** Allocation-weighted token-vs-mark %, rounded to 0.1; null when no constituent has both prices. */
  value: number | null;
  /** Constituents with a usable token and mark price. */
  covered: number;
  total: number;
};

/**
 * Allocation-weighted token-vs-mark premium for a basket:
 * Σ(wᵢ × premiumᵢ) ÷ Σwᵢ over constituents that have both prices. Weights are
 * the basket's reference allocations. Not a NAV or a tradable basket price.
 */
export function basketPremium(
  items: { allocation: number; stock: Pick<PreStock, "tokenPrice" | "markPrice"> | null }[],
): BasketPremium {
  let weighted = 0;
  let weight = 0;
  let covered = 0;
  for (const item of items) {
    if (!item.stock || !(item.allocation > 0)) continue;
    const premium = tokenVsMark(item.stock);
    if (premium == null) continue;
    weighted += item.allocation * premium;
    weight += item.allocation;
    covered += 1;
  }
  return {
    value: weight > 0 ? round1(weighted / weight) : null,
    covered,
    total: items.length,
  };
}
