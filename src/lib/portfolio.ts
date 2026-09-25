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

/** A catalog price is usable only when it is a finite, positive number. */
export function usablePrice(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function matchPreStockHoldings(
  tokens: WalletToken[],
  stocks: PreStock[],
): PortfolioPosition[] {
  const catalog = catalogByContract(stocks);
  const quantities = mergeQuantities(tokens);
  const matched: PortfolioPosition[] = [];

  for (const [mint, quantity] of quantities) {
    const stock = catalog.get(mint);
    if (!stock) continue;
    const tokenPrice = usablePrice(stock.tokenPrice);
    matched.push({
      symbol: stock.symbol,
      name: stock.name,
      image: stock.image,
      initials: stock.initials,
      contractAddress: stock.contractAddress,
      quantity,
      tokenPrice,
      value: tokenPrice != null ? round2(quantity * tokenPrice) : null,
      allocation: null,
      costBasis: null,
      unrealizedPnl: null,
      unrealizedPnlPercent: null,
    });
  }

  const totalValue = matched.reduce((sum, item) => sum + (item.value ?? 0), 0);
  return matched
    .map((item) => ({
      ...item,
      allocation:
        item.value != null && totalValue > 0
          ? round1((item.value / totalValue) * 100)
          : null,
    }))
    .sort(
      (a, b) =>
        (b.value ?? -1) - (a.value ?? -1) || a.symbol.localeCompare(b.symbol),
    );
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
  const totalValue = round2(positions.reduce((sum, item) => sum + (item.value ?? 0), 0));
  const unpricedCount = positions.filter((item) => item.value == null).length;
  const transactions = history?.transactions ?? [];
  const historyStatus = history?.status ?? "ok";
  const { byMint, realizedPnl } = applyAverageCost(transactions);

  const withCost = positions.map((item) => {
    const mint = normalizeContractAddress(item.contractAddress);
    const cost = positionCostFromState(byMint.get(mint), item.quantity, item.value ?? 0);
    // Without a current price there is no unrealized P&L — only cost basis.
    const priced = item.value != null;
    return {
      ...item,
      costBasis: cost.remainingCostBasis,
      unrealizedPnl: priced ? cost.unrealizedPnl : null,
      unrealizedPnlPercent: priced ? cost.unrealizedPnlPercent : null,
    };
  });

  const costComplete =
    historyStatus === "ok" &&
    withCost.every((item) => item.quantity <= 0 || item.costBasis != null);
  const totalCostBasis = costComplete
    ? round2(withCost.reduce((sum, item) => sum + (item.costBasis ?? 0), 0))
    : null;
  const unrealizedPnl =
    totalCostBasis != null && unpricedCount === 0
      ? round2(totalValue - totalCostBasis)
      : null;

  const sortedTx = [...transactions].sort((a, b) => {
    const at = a.timestamp ? Date.parse(a.timestamp) : 0;
    const bt = b.timestamp ? Date.parse(b.timestamp) : 0;
    return bt - at;
  });

  return {
    wallet: wallet.trim(),
    fetchedAt,
    totalValue,
    unpricedCount,
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

/** Explain why each summary figure is present, partial, or unavailable. */
export function summaryNotes(snapshot: PortfolioSnapshot) {
  const held = snapshot.positions.length;
  const covered = snapshot.positions.filter((item) => item.costBasis != null).length;
  const hasSales = snapshot.transactions.some((tx) => tx.type === "sell");

  const history =
    snapshot.historyStatus === "unavailable"
      ? "unavailable"
      : snapshot.historyStatus === "partial"
        ? "partial (older transactions not loaded)"
        : "loaded";

  let costBasis: string;
  if (held === 0) {
    costBasis = "No current holdings";
  } else if (snapshot.totalCostBasis != null) {
    costBasis = `Verified for all ${held} holding${held === 1 ? "" : "s"}`;
  } else if (snapshot.historyStatus === "unavailable") {
    costBasis = "Transaction history unavailable";
  } else {
    costBasis = `Verified for ${covered} of ${held} holding${held === 1 ? "" : "s"}`;
  }

  let unrealized: string;
  if (snapshot.unrealizedPnl != null) {
    unrealized = "Current value − cost basis";
  } else if (snapshot.totalCostBasis != null && snapshot.unpricedCount > 0) {
    unrealized = "Some holdings have no current price";
  } else {
    unrealized = "Needs verified cost basis for every holding";
  }

  let realized: string;
  if (snapshot.realizedPnl == null) {
    realized =
      snapshot.historyStatus === "ok"
        ? "Some sales lack verified cost or proceeds"
        : "Needs complete transaction history";
  } else if (!hasSales) {
    realized = "No sales in loaded history";
  } else {
    realized = "From verified sales in loaded history";
  }

  return { history, costBasis, unrealized, realized };
}
