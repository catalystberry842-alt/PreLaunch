import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  comparePortfolioToBasket,
  portfolioHoldingsFromSnapshot,
} from "./compare.ts";
import type { Basket, PreStock } from "./types.ts";
import type { PortfolioSnapshot } from "../types/portfolio.ts";

const openai: PreStock = {
  id: "OPENAI",
  name: "OpenAI",
  officialName: "OpenAI",
  symbol: "OPENAI",
  category: "AI",
  initials: "OA",
  image: "",
  description: "",
  externalUrl: "",
  contractAddress: "mint-openai",
  markPrice: 0,
  markValuation: 0,
  tokenPrice: 100,
  impliedValuation: 0,
  supply: 0,
};

const anthropic: PreStock = {
  ...openai,
  id: "ANTHROPIC",
  name: "Anthropic",
  officialName: "Anthropic",
  symbol: "ANTHROPIC",
  initials: "AN",
  contractAddress: "mint-anthropic",
};

const figure: PreStock = {
  ...openai,
  id: "FIGUREAI",
  name: "Figure AI",
  officialName: "Figure AI",
  symbol: "FIGUREAI",
  initials: "FI",
  contractAddress: "mint-figure",
};

const basket: Basket = {
  id: "ai-infrastructure",
  name: "AI Infrastructure",
  category: "AI",
  creator: "mira.chen",
  source: "catalog",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  views: 0,
  saves: 0,
  description: "Test basket",
  thesis: "",
  constituents: [
    { preStockId: "OPENAI", allocation: 30 },
    { preStockId: "ANTHROPIC", allocation: 45 },
    { preStockId: "FIGUREAI", allocation: 25 },
  ],
};

function snapshot(positions: PortfolioSnapshot["positions"]): PortfolioSnapshot {
  const totalValue = positions.reduce((sum, item) => sum + item.value, 0);
  return {
    wallet: "Wallet1111111111111111111111111111111111111",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    totalValue,
    totalCostBasis: null,
    unrealizedPnl: null,
    realizedPnl: null,
    costBasisMethod: "average_cost",
    positions,
    transactions: [],
    historyStatus: "ok",
    historyMessage: null,
    historyTruncated: false,
  };
}

function position(
  symbol: string,
  value: number,
): PortfolioSnapshot["positions"][number] {
  return {
    symbol,
    name: symbol,
    image: "",
    initials: symbol.slice(0, 2),
    contractAddress: `mint-${symbol.toLowerCase()}`,
    quantity: 1,
    tokenPrice: value,
    value,
    allocation: 0,
    costBasis: null,
    unrealizedPnl: null,
    unrealizedPnlPercent: null,
  };
}

describe("comparePortfolioToBasket", () => {
  it("computes overlap, unique sides, and signed difference", () => {
    const result = comparePortfolioToBasket(
      snapshot([
        position("OPENAI", 400),
        position("ANTHROPIC", 100),
        position("KALSHI", 500),
      ]),
      basket,
      [openai, anthropic, figure],
    );

    assert.equal(result.portfolioValue, 1000);
    const openaiRow = result.overlap.find((row) => row.symbol === "OPENAI");
    assert.equal(openaiRow?.portfolioPercent, 40);
    assert.equal(openaiRow?.basketPercent, 30);
    assert.equal(openaiRow?.difference, 10);

    assert.equal(result.portfolioOnly.map((row) => row.symbol).join(), "KALSHI");
    assert.equal(result.basketOnly.map((row) => row.symbol).join(), "FIGUREAI");
    assert.ok(
      result.insights.some((line) =>
        line.includes("You hold 40% OPENAI while this basket allocates 30%."),
      ),
    );
    assert.ok(
      result.insights.some((line) =>
        line.includes("KALSHI is in your portfolio at 50% and is not in this basket."),
      ),
    );
    assert.ok(
      result.insights.some((line) =>
        line.includes("FIGUREAI is in this basket at 25% and is not in your portfolio."),
      ),
    );
  });

  it("does not invent a basket dollar value or performance", () => {
    const result = comparePortfolioToBasket(
      snapshot([position("OPENAI", 100)]),
      basket,
      [openai, anthropic, figure],
    );
    assert.equal(result.portfolioValue, 100);
    assert.equal(
      result.rows.every((row) => Number.isFinite(row.basketPercent)),
      true,
    );
  });
});

describe("portfolioHoldingsFromSnapshot", () => {
  it("turns live position values into allocations for the existing simulator", () => {
    const holdings = portfolioHoldingsFromSnapshot(
      snapshot([position("OPENAI", 250), position("ANTHROPIC", 750)]),
      [openai, anthropic],
    );
    assert.equal(holdings[0]?.allocation, 25);
    assert.equal(holdings[1]?.allocation, 75);
    assert.equal(holdings[0]?.stock?.id, "OPENAI");
  });
});
