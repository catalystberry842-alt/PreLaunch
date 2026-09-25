import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAverageCost, positionCostFromState } from "./cost-basis.ts";
import { parsePreStockTransactions, fromParsedRpcTransaction } from "./helius-history.ts";
import type { PortfolioTransaction } from "../types/portfolio.ts";
import type { PreStock } from "./types.ts";

const openaiMint = "PreweJYECqtQxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1";
const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const wallet = "Wallet1111111111111111111111111111111111111";

const openaiStock: PreStock = {
  id: "OPENAI",
  name: "OpenAI",
  officialName: "OpenAI",
  symbol: "OPENAI",
  category: "AI",
  initials: "OA",
  image: "",
  description: "",
  externalUrl: "",
  contractAddress: openaiMint,
  markPrice: 0,
  markValuation: 0,
  tokenPrice: 110,
  impliedValuation: 0,
  supply: 0,
};

function tx(
  partial: Partial<PortfolioTransaction> &
    Pick<PortfolioTransaction, "type" | "direction" | "quantity">,
): PortfolioTransaction {
  return {
    walletAddress: wallet,
    signature: partial.signature ?? "sig",
    timestamp: partial.timestamp ?? "2026-01-01T00:00:00.000Z",
    mint: openaiMint,
    symbol: "OPENAI",
    name: "OpenAI",
    unitPriceUsd: partial.unitPriceUsd ?? null,
    valueUsd: partial.valueUsd ?? null,
    costBasisEligible: partial.costBasisEligible ?? false,
    typeLabel: partial.typeLabel ?? partial.type,
    ...partial,
  };
}

describe("applyAverageCost", () => {
  it("uses average cost: 10@100 then 10@120, sell 5@150", () => {
    const { byMint, realizedPnl } = applyAverageCost([
      tx({
        type: "buy",
        direction: "in",
        quantity: 10,
        valueUsd: 1000,
        unitPriceUsd: 100,
        costBasisEligible: true,
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      tx({
        type: "buy",
        direction: "in",
        quantity: 10,
        valueUsd: 1200,
        unitPriceUsd: 120,
        costBasisEligible: true,
        timestamp: "2026-01-02T00:00:00.000Z",
      }),
      tx({
        type: "sell",
        direction: "out",
        quantity: 5,
        valueUsd: 750,
        unitPriceUsd: 150,
        timestamp: "2026-01-03T00:00:00.000Z",
      }),
    ]);
    const state = byMint.get(openaiMint);
    assert.equal(state?.knownQty, 15);
    assert.equal(state?.knownCost, 1650);
    assert.equal(realizedPnl, 200);
    const pos = positionCostFromState(state, 15, 1800);
    assert.equal(pos.remainingCostBasis, 1650);
    assert.equal(pos.unrealizedPnl, 150);
  });

  it("does not let a transfer create acquisition cost or realized P&L", () => {
    const { byMint, realizedPnl } = applyAverageCost([
      tx({
        type: "buy",
        direction: "in",
        quantity: 10,
        valueUsd: 1000,
        costBasisEligible: true,
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      tx({
        type: "transfer_in",
        direction: "in",
        quantity: 4,
        valueUsd: null,
        timestamp: "2026-01-02T00:00:00.000Z",
      }),
      tx({
        type: "transfer_out",
        direction: "out",
        quantity: 2,
        timestamp: "2026-01-03T00:00:00.000Z",
      }),
    ]);
    assert.equal(realizedPnl, 0);
    const state = byMint.get(openaiMint);
    assert.equal(state?.knownQty, 10);
    assert.equal(state?.knownCost, 1000);
    const pos = positionCostFromState(state, 12, 1200);
    assert.equal(pos.remainingCostBasis, null);
    assert.equal(pos.unrealizedPnl, null);
  });
  it("averages two priced acquisitions", () => {
    const { byMint, realizedPnl } = applyAverageCost([
      tx({
        type: "buy",
        direction: "in",
        quantity: 1,
        valueUsd: 100,
        costBasisEligible: true,
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      tx({
        type: "buy",
        direction: "in",
        quantity: 1,
        valueUsd: 200,
        costBasisEligible: true,
        timestamp: "2026-01-02T00:00:00.000Z",
      }),
    ]);
    const state = byMint.get(openaiMint);
    assert.equal(state?.knownQty, 2);
    assert.equal(state?.knownCost, 300);
    assert.equal(realizedPnl, 0);
    const pos = positionCostFromState(state, 2, 400);
    assert.equal(pos.remainingCostBasis, 300);
    assert.equal(pos.unrealizedPnl, 100);
    assert.equal(pos.unrealizedPnlPercent, 33.33);
  });

  it("realizes P&L on a priced sale using average cost", () => {
    const { byMint, realizedPnl } = applyAverageCost([
      tx({
        type: "buy",
        direction: "in",
        quantity: 2,
        valueUsd: 200,
        costBasisEligible: true,
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      tx({
        type: "sell",
        direction: "out",
        quantity: 1,
        valueUsd: 180,
        costBasisEligible: false,
        timestamp: "2026-01-03T00:00:00.000Z",
      }),
    ]);
    assert.equal(realizedPnl, 80);
    const state = byMint.get(openaiMint);
    assert.equal(state?.knownQty, 1);
    assert.equal(state?.knownCost, 100);
  });

  it("does not treat a transfer in as a purchase", () => {
    const { byMint, realizedPnl } = applyAverageCost([
      tx({
        type: "transfer_in",
        direction: "in",
        quantity: 5,
        valueUsd: null,
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
    ]);
    const pos = positionCostFromState(byMint.get(openaiMint), 5, 500);
    assert.equal(pos.remainingCostBasis, null);
    assert.equal(pos.unrealizedPnl, null);
    assert.equal(realizedPnl, 0);
  });

  it("reduces remaining cost on transfer out without realizing P&L", () => {
    const { byMint, realizedPnl } = applyAverageCost([
      tx({
        type: "buy",
        direction: "in",
        quantity: 2,
        valueUsd: 200,
        costBasisEligible: true,
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      tx({
        type: "transfer_out",
        direction: "out",
        quantity: 1,
        timestamp: "2026-01-02T00:00:00.000Z",
      }),
    ]);
    assert.equal(realizedPnl, 0);
    const state = byMint.get(openaiMint);
    assert.equal(state?.knownQty, 1);
    assert.equal(state?.knownCost, 100);
  });

  it("does not invent realized P&L when a sale has no proceeds", () => {
    const { realizedPnl } = applyAverageCost([
      tx({
        type: "buy",
        direction: "in",
        quantity: 1,
        valueUsd: 100,
        costBasisEligible: true,
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      tx({
        type: "sell",
        direction: "out",
        quantity: 1,
        valueUsd: null,
        timestamp: "2026-01-02T00:00:00.000Z",
      }),
    ]);
    assert.equal(realizedPnl, null);
  });

  it("does not invent cost basis when current quantity is not fully covered", () => {
    const { byMint } = applyAverageCost([
      tx({
        type: "buy",
        direction: "in",
        quantity: 1,
        valueUsd: 100,
        costBasisEligible: true,
      }),
    ]);
    const pos = positionCostFromState(byMint.get(openaiMint), 3, 300);
    assert.equal(pos.remainingCostBasis, null);
  });
});

describe("parsePreStockTransactions", () => {
  const stock = openaiStock;

  it("matches swaps by mint, not symbol, and prices USDC as USD", () => {
    const parsed = parsePreStockTransactions(
      [
        {
          signature: "BuySig111111111111111111111111111111111111111",
          timestamp: 1_700_000_000,
          type: "SWAP",
          tokenTransfers: [
            {
              fromUserAccount: wallet,
              toUserAccount: "Pool11111111111111111111111111111111111111",
              mint: usdc,
              tokenAmount: 250,
            },
            {
              fromUserAccount: "Pool11111111111111111111111111111111111111",
              toUserAccount: wallet,
              mint: openaiMint,
              tokenAmount: 2,
            },
          ],
        },
      ],
      wallet,
      [stock],
    );
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].type, "buy");
    assert.equal(parsed[0].quantity, 2);
    assert.equal(parsed[0].valueUsd, 250);
    assert.equal(parsed[0].unitPriceUsd, 125);
    assert.equal(parsed[0].costBasisEligible, true);
    assert.equal(parsed[0].walletAddress, wallet);
  });

  it("does not match a transfer by the token symbol", () => {
    const parsed = parsePreStockTransactions(
      [
        {
          signature: "NoMatch",
          timestamp: 1_700_000_000,
          type: "TRANSFER",
          tokenTransfers: [
            {
              fromUserAccount: "Other1111111111111111111111111111111111111",
              toUserAccount: wallet,
              mint: "OPENAI",
              tokenAmount: 9,
            },
          ],
        },
      ],
      wallet,
      [stock],
    );
    assert.equal(parsed.length, 0);
  });

  it("labels an unpriced inbound transfer as transfer in, not a buy", () => {
    const parsed = parsePreStockTransactions(
      [
        {
          signature: "InSig",
          timestamp: 1_700_000_100,
          type: "TRANSFER",
          tokenTransfers: [
            {
              fromUserAccount: "Other1111111111111111111111111111111111111",
              toUserAccount: wallet,
              mint: openaiMint,
              tokenAmount: 1.5,
            },
          ],
        },
      ],
      wallet,
      [stock],
    );
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].type, "transfer_in");
    assert.equal(parsed[0].valueUsd, null);
    assert.equal(parsed[0].costBasisEligible, false);
  });

  it("labels a swap out as a sell only when the mint matches", () => {
    const parsed = parsePreStockTransactions(
      [
        {
          signature: "SellSig",
          timestamp: 1_700_000_200,
          type: "SWAP",
          tokenTransfers: [
            {
              fromUserAccount: wallet,
              toUserAccount: "Pool11111111111111111111111111111111111111",
              mint: openaiMint,
              tokenAmount: 1,
            },
            {
              fromUserAccount: "Pool11111111111111111111111111111111111111",
              toUserAccount: wallet,
              mint: usdc,
              tokenAmount: 140,
            },
          ],
        },
      ],
      wallet,
      [stock],
    );
    assert.equal(parsed[0].type, "sell");
    assert.equal(parsed[0].valueUsd, 140);
  });

  it("does not treat a SOL-only swap as a priced buy", () => {
    const parsed = parsePreStockTransactions(
      [
        {
          signature: "SolSwap",
          timestamp: 1_700_000_300,
          type: "SWAP",
          tokenTransfers: [
            {
              fromUserAccount: "Pool11111111111111111111111111111111111111",
              toUserAccount: wallet,
              mint: openaiMint,
              tokenAmount: 1,
            },
          ],
          nativeTransfers: [
            {
              fromUserAccount: wallet,
              toUserAccount: "Pool11111111111111111111111111111111111111",
              amount: 1_000_000_000,
            },
          ],
        },
      ],
      wallet,
      [stock],
    );
    assert.equal(parsed[0].type, "transfer_in");
    assert.equal(parsed[0].valueUsd, null);
    assert.equal(parsed[0].costBasisEligible, false);
  });
});

describe("fromParsedRpcTransaction", () => {
  it("nets pre/post token balances for the wallet owner", () => {
    const normalized = fromParsedRpcTransaction(
      {
        blockTime: 1_700_000_000,
        meta: {
          err: null,
          preTokenBalances: [
            {
              mint: openaiMint,
              owner: wallet,
              uiTokenAmount: { amount: "1000000000", decimals: 9, uiAmount: 1 },
            },
            {
              mint: usdc,
              owner: wallet,
              uiTokenAmount: { amount: "250000000", decimals: 6, uiAmount: 250 },
            },
          ],
          postTokenBalances: [
            {
              mint: openaiMint,
              owner: wallet,
              uiTokenAmount: { amount: "3000000000", decimals: 9, uiAmount: 3 },
            },
            {
              mint: usdc,
              owner: wallet,
              uiTokenAmount: { amount: "0", decimals: 6, uiAmount: 0 },
            },
          ],
        },
        transaction: { signatures: ["ParsedSig111111111111111111111111111111111"] },
      },
      wallet,
    );
    assert.ok(normalized);
    assert.equal(normalized?.type, "SWAP");
    const parsed = parsePreStockTransactions([normalized], wallet, [openaiStock]);
    assert.equal(parsed[0].type, "buy");
    assert.equal(parsed[0].quantity, 2);
    assert.equal(parsed[0].valueUsd, 250);
    assert.equal(parsed[0].typeLabel, "Buy / Acquisition");
  });
});

describe("parsePreStockTransactions — balance deltas and routes", () => {
  const pool = "Pool11111111111111111111111111111111111111";
  const wsol = "So11111111111111111111111111111111111111112";

  it("uses balance deltas so the Token-2022 transfer fee is not counted as received", () => {
    const parsed = parsePreStockTransactions(
      [
        {
          signature: "FeeSig",
          timestamp: 1_700_000_000,
          type: "SWAP",
          tokenTransfers: [
            { fromUserAccount: wallet, toUserAccount: pool, mint: usdc, tokenAmount: 100 },
            { fromUserAccount: pool, toUserAccount: wallet, mint: openaiMint, tokenAmount: 1 },
          ],
          accountData: [
            {
              account: wallet,
              nativeBalanceChange: -5000,
              tokenBalanceChanges: [
                {
                  userAccount: wallet,
                  mint: usdc,
                  rawTokenAmount: { tokenAmount: "-100000000", decimals: 6 },
                },
                {
                  userAccount: wallet,
                  mint: openaiMint,
                  // 1% fee withheld: 0.99 actually arrives.
                  rawTokenAmount: { tokenAmount: "990000000", decimals: 9 },
                },
              ],
            },
          ],
        },
      ],
      wallet,
      [openaiStock],
    );
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].type, "buy");
    assert.equal(parsed[0].quantity, 0.99);
    assert.equal(parsed[0].valueUsd, 100);
  });

  it("prices an aggregator route labelled TRANSFER when the wSOL hop nets to zero", () => {
    const parsed = parsePreStockTransactions(
      [
        {
          signature: "RouteSig",
          timestamp: 1_700_000_100,
          type: "TRANSFER",
          tokenTransfers: [
            { fromUserAccount: wallet, toUserAccount: pool, mint: usdc, tokenAmount: 100 },
            { fromUserAccount: pool, toUserAccount: wallet, mint: wsol, tokenAmount: 0.5 },
            { fromUserAccount: wallet, toUserAccount: pool, mint: wsol, tokenAmount: 0.5 },
            { fromUserAccount: pool, toUserAccount: wallet, mint: openaiMint, tokenAmount: 0.8 },
          ],
        },
      ],
      wallet,
      [openaiStock],
    );
    assert.equal(parsed[0].type, "buy");
    assert.equal(parsed[0].valueUsd, 100);
    assert.equal(parsed[0].unitPriceUsd, 125);
  });

  it("does not price a trade that also spends wrapped SOL", () => {
    const parsed = parsePreStockTransactions(
      [
        {
          signature: "MixedSig",
          timestamp: 1_700_000_200,
          type: "SWAP",
          tokenTransfers: [
            { fromUserAccount: wallet, toUserAccount: pool, mint: usdc, tokenAmount: 50 },
            { fromUserAccount: wallet, toUserAccount: pool, mint: wsol, tokenAmount: 0.3 },
            { fromUserAccount: pool, toUserAccount: wallet, mint: openaiMint, tokenAmount: 1 },
          ],
        },
      ],
      wallet,
      [openaiStock],
    );
    assert.equal(parsed[0].type, "transfer_in");
    assert.equal(parsed[0].valueUsd, null);
  });

  it("does not price a trade that also spends native SOL beyond fees", () => {
    const parsed = parsePreStockTransactions(
      [
        {
          signature: "NativeSig",
          timestamp: 1_700_000_300,
          type: "SWAP",
          tokenTransfers: [
            { fromUserAccount: wallet, toUserAccount: pool, mint: usdc, tokenAmount: 50 },
            { fromUserAccount: pool, toUserAccount: wallet, mint: openaiMint, tokenAmount: 1 },
          ],
          accountData: [{ account: wallet, nativeBalanceChange: -1_000_000_000 }],
        },
      ],
      wallet,
      [openaiStock],
    );
    assert.equal(parsed[0].type, "transfer_in");
  });
});
