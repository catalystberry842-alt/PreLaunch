import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPortfolioSnapshot, matchPreStockHoldings } from "./portfolio.ts";
import { isSolanaAddress } from "./solana-address.ts";
import type { PreStock } from "./types.ts";

const openaiMint = "PreweJYECqtQxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1";
const spaceMint = "PreANxuXjsy2xxxxxxxxxxxxxxxxxxxxxxxxxxxxx2";
const otherMint = "So11111111111111111111111111111111111111112";

function stock(partial: Partial<PreStock> & Pick<PreStock, "symbol" | "contractAddress" | "tokenPrice">): PreStock {
  return {
    id: partial.symbol,
    name: partial.name ?? partial.symbol,
    officialName: partial.symbol,
    category: "AI",
    initials: partial.symbol.slice(0, 2),
    image: "",
    description: "",
    externalUrl: "",
    markPrice: 0,
    markValuation: 0,
    impliedValuation: 0,
    supply: 0,
    ...partial,
  };
}

const catalog: PreStock[] = [
  stock({ symbol: "OPENAI", name: "OpenAI", contractAddress: openaiMint, tokenPrice: 100 }),
  stock({ symbol: "SPACEX", name: "SpaceX", contractAddress: spaceMint, tokenPrice: 50 }),
];

describe("isSolanaAddress", () => {
  it("accepts a 32-byte base58 pubkey", () => {
    assert.equal(isSolanaAddress("11111111111111111111111111111111"), true);
    assert.equal(
      isSolanaAddress("PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB"),
      true,
    );
  });

  it("rejects short, empty, and non-base58 values", () => {
    assert.equal(isSolanaAddress(""), false);
    assert.equal(isSolanaAddress("not-a-wallet"), false);
    assert.equal(isSolanaAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"), false);
    assert.equal(isSolanaAddress("abc"), false);
  });
});

describe("matchPreStockHoldings", () => {
  it("matches only by contract address, never by symbol or name", () => {
    const positions = matchPreStockHoldings(
      [
        { mint: openaiMint, quantity: 2 },
        { mint: "OPENAI", quantity: 99 },
        { mint: "OpenAI", quantity: 99 },
      ],
      catalog,
    );
    assert.equal(positions.length, 1);
    assert.equal(positions[0].symbol, "OPENAI");
    assert.equal(positions[0].quantity, 2);
    assert.equal(positions[0].value, 200);
  });

  it("does not match a lowercased mint against a mixed-case contract", () => {
    const positions = matchPreStockHoldings(
      [{ mint: openaiMint.toLowerCase(), quantity: 2 }],
      catalog,
    );
    assert.equal(positions.length, 0);
  });

  it("trims contract addresses before matching", () => {
    const positions = matchPreStockHoldings(
      [{ mint: `  ${openaiMint}  `, quantity: 1 }],
      catalog,
    );
    assert.equal(positions.length, 1);
    assert.equal(positions[0].symbol, "OPENAI");
  });

  it("ignores unrelated wallet tokens", () => {
    const positions = matchPreStockHoldings(
      [
        { mint: otherMint, quantity: 40 },
        { mint: spaceMint, quantity: 3 },
      ],
      catalog,
    );
    assert.equal(positions.length, 1);
    assert.equal(positions[0].symbol, "SPACEX");
    assert.equal(positions[0].value, 150);
  });

  it("skips zero and non-finite quantities", () => {
    const positions = matchPreStockHoldings(
      [
        { mint: openaiMint, quantity: 0 },
        { mint: spaceMint, quantity: Number.NaN },
      ],
      catalog,
    );
    assert.equal(positions.length, 0);
  });

  it("sums duplicate mints and allocates by value", () => {
    const positions = matchPreStockHoldings(
      [
        { mint: openaiMint, quantity: 1 },
        { mint: openaiMint, quantity: 1 },
        { mint: spaceMint, quantity: 2 },
      ],
      catalog,
    );
    assert.equal(positions.length, 2);
    assert.equal(positions[0].symbol, "OPENAI");
    assert.equal(positions[0].quantity, 2);
    assert.equal(positions[0].value, 200);
    assert.equal(positions[0].allocation, 66.7);
    assert.equal(positions[1].symbol, "SPACEX");
    assert.equal(positions[1].value, 100);
    assert.equal(positions[1].allocation, 33.3);
  });
});

describe("buildPortfolioSnapshot", () => {
  it("returns an empty snapshot when the wallet has no PreStocks", () => {
    const snapshot = buildPortfolioSnapshot(
      "11111111111111111111111111111111",
      [{ mint: otherMint, quantity: 12 }],
      catalog,
      "2026-09-19T00:00:00.000Z",
    );
    assert.equal(snapshot.positions.length, 0);
    assert.equal(snapshot.totalValue, 0);
    assert.equal(snapshot.fetchedAt, "2026-09-19T00:00:00.000Z");
  });

  it("uses PreStocks tokenPrice for position value", () => {
    const snapshot = buildPortfolioSnapshot(
      "11111111111111111111111111111111",
      [{ mint: openaiMint, quantity: 12.42 }],
      catalog,
    );
    assert.equal(snapshot.totalValue, 1242);
    assert.equal(snapshot.positions[0].tokenPrice, 100);
  });
});

describe("parseTokenAccount", () => {
  it("reads quantity from amount and decimals, not symbol", async () => {
    const { parseTokenAccount } = await import("./solana-rpc.server.ts");
    const parsed = parseTokenAccount({
      account: {
        data: {
          program: "spl-token-2022",
          parsed: {
            info: {
              mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
              tokenAmount: {
                amount: "1829331397",
                decimals: 9,
                uiAmount: 2.718632866,
              },
            },
          },
        },
      },
    });
    assert.equal(parsed?.mint, "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF");
    assert.equal(parsed?.quantity, 1.829331397);
  });

  it("skips zero-balance accounts", async () => {
    const { parseTokenAccount } = await import("./solana-rpc.server.ts");
    const parsed = parseTokenAccount({
      account: {
        data: {
          parsed: {
            info: {
              mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
              tokenAmount: { amount: "0", decimals: 9, uiAmount: 0 },
            },
          },
        },
      },
    });
    assert.equal(parsed, null);
  });
});
