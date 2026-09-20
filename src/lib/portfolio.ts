import { applyAverageCost, positionCostFromState } from "./cost-basis.ts";
import { round1, round2 } from "./format.ts";
import type { PreStock } from "./types.ts";
import { normalizeContractAddress } from "../types/prestocks.ts";
import type {
  PortfolioHistoryStatus,
  PortfolioPosition,
  PortfolioSnapshot,
  PortfolioTransaction,
  WalletToken,
} from "../types/portfolio.ts";

function catalogByContract(stocks: PreStock[]) {
  const map = new Map<string, PreStock>();
  for (const stock of stocks) {
    const address = normalizeContractAddress(stock.contractAddress);
    if (!address || map.has(address)) continue;
    map.set(address, stock);
  }
  return map;
}

function mergeQuantities(tokens: WalletToken[]) {
  const merged = new Map<string, number>();
  for (const token of tokens) {
    const mint = normalizeContractAddress(token.mint);
    if (!mint || token.quantity <= 0 || !Number.isFinite(token.quantity)) continue;
    merged.set(mint, (merged.get(mint) ?? 0) + token.quantity);
  }
  return merged;
}

export function matchPreStockHoldings(
  tokens: WalletToken[],
  stocks: PreStock[],
): PortfolioPosition[] {
  const catalog = catalogByContract(stocks);
  const quantities = mergeQuantities(tokens);
  const unmatched: PortfolioPosition[] = [];

  for (const [mint, quantity] of quantities) {
    const stock = catalog.get(mint);
    if (!stock) continue;
    const tokenPrice = Number.isFinite(stock.tokenPrice) ? stock.tokenPrice : 0;
    const value = round2(quantity * tokenPrice);
    unmatched.push({
      symbol: stock.symbol,
      name: stock.name,
      image: stock.image,
      initials: stock.initials,
      contractAddress: stock.contractAddress,
      quantity,
      tokenPrice,
      value,
      allocation: 0,
      costBasis: null,
      unrealizedPnl: null,
      unrealizedPnlPercent: null,
    });
  }

  const totalValue = unmatched.reduce((sum, item) => sum + item.value, 0);
  const positions = unmatched
    .map((item) => ({
      ...item,
      allocation: totalValue > 0 ? round1((item.value / totalValue) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value || a.symbol.localeCompare(b.symbol));

  return positions;
}

export function buildPortfolioSnapshot(
  wallet: string,
  tokens: WalletToken[],
  stocks: PreStock[],
  fetchedAt = new Date().toISOString(),
  history?: {
    transactions?: PortfolioTransaction[];
    status?: PortfolioHistoryStatus;
    message?: string | null;
    truncated?: boolean;
  },
): PortfolioSnapshot {
  const positions = matchPreStockHoldings(tokens, stocks);
  const totalValue = round2(positions.reduce((sum, item) => sum + item.value, 0));
  const transactions = history?.transactions ?? [];
  const historyStatus = history?.status ?? (transactions.length ? "ok" : "ok");
  const { byMint, realizedPnl } = applyAverageCost(transactions);

  const withCost = positions.map((item) => {
    const mint = normalizeContractAddress(item.contractAddress);
    const cost = positionCostFromState(byMint.get(mint), item.quantity, item.value);
    return {
      ...item,
      costBasis: cost.remainingCostBasis,
      unrealizedPnl: cost.unrealizedPnl,
      unrealizedPnlPercent: cost.unrealizedPnlPercent,
    };
  });

  const costComplete =
    historyStatus === "ok" &&
    withCost.every((item) => item.quantity <= 0 || item.costBasis != null);
  const totalCostBasis = costComplete
    ? round2(withCost.reduce((sum, item) => sum + (item.costBasis ?? 0), 0))
    : null;
  const unrealizedPnl =
    totalCostBasis != null ? round2(totalValue - totalCostBasis) : null;

  const sortedTx = [...transactions].sort((a, b) => {
    const at = a.timestamp ? Date.parse(a.timestamp) : 0;
    const bt = b.timestamp ? Date.parse(b.timestamp) : 0;
    return bt - at;
  });

  return {
    wallet: wallet.trim(),
    fetchedAt,
    totalValue,
    totalCostBasis,
    unrealizedPnl,
    realizedPnl: historyStatus === "ok" ? realizedPnl : null,
    costBasisMethod: "average_cost",
    positions: withCost,
    transactions: sortedTx,
    historyStatus,
    historyMessage: history?.message ?? null,
    historyTruncated: history?.truncated === true,
  };
}
