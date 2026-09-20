import { round2 } from "./format.ts";
import type { PortfolioTransaction } from "../types/portfolio.ts";

/** Dust threshold for 9-decimal SPL amounts. */
const QTY_EPS = 1e-8;

export const COST_BASIS_METHOD = "average_cost" as const;

export type MintCostState = {
  mint: string;
  knownQty: number;
  knownCost: number;
  unknownQty: number;
  realizedPnl: number;
  realizedReliable: boolean;
};

export type PositionCostResult = {
  remainingCostBasis: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPercent: number | null;
};

function isPositiveQty(value: number) {
  return Number.isFinite(value) && value > QTY_EPS;
}

function emptyState(mint: string): MintCostState {
  return {
    mint,
    knownQty: 0,
    knownCost: 0,
    unknownQty: 0,
    realizedPnl: 0,
    realizedReliable: true,
  };
}

function reduceUnknownThenKnown(state: MintCostState, qty: number) {
  let remaining = qty;
  if (state.unknownQty > QTY_EPS) {
    const take = Math.min(state.unknownQty, remaining);
    state.unknownQty = Math.max(0, state.unknownQty - take);
    remaining -= take;
  }
  if (remaining > QTY_EPS && state.knownQty > QTY_EPS) {
    const take = Math.min(state.knownQty, remaining);
    const avg = state.knownCost / state.knownQty;
    state.knownQty = Math.max(0, state.knownQty - take);
    state.knownCost = state.knownQty > QTY_EPS ? round2(avg * state.knownQty) : 0;
    remaining -= take;
  }
  if (state.knownQty <= QTY_EPS) {
    state.knownQty = 0;
    state.knownCost = 0;
  }
  if (state.unknownQty <= QTY_EPS) state.unknownQty = 0;
  return remaining;
}

/**
 * Average cost: remaining cost ÷ remaining known-cost quantity.
 * Only verified USD acquisitions enter the average. Transfers never create
 * a purchase price. Transfer-out reduces remaining cost and does not realize
 * gain or loss. A sale realizes P&L only when proceeds and the remaining
 * average cost are both known and the sold quantity is fully covered by
 * known-cost inventory (no unknown-cost tokens in the book).
 */
export function applyAverageCost(transactions: PortfolioTransaction[]) {
  const states = new Map<string, MintCostState>();
  const chronological = [...transactions].sort((a, b) => {
    const at = a.timestamp ? Date.parse(a.timestamp) : Number.POSITIVE_INFINITY;
    const bt = b.timestamp ? Date.parse(b.timestamp) : Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return (a.signature ?? "").localeCompare(b.signature ?? "");
  });

  for (const tx of chronological) {
    if (!isPositiveQty(tx.quantity)) continue;
    const state = states.get(tx.mint) ?? emptyState(tx.mint);
    const inbound = tx.direction === "in";

    if (inbound) {
      if (tx.costBasisEligible && tx.valueUsd != null && tx.valueUsd >= 0) {
        state.knownQty += tx.quantity;
        state.knownCost = round2(state.knownCost + tx.valueUsd);
      } else {
        state.unknownQty += tx.quantity;
      }
    } else if (tx.type === "sell") {
      const covered =
        state.unknownQty <= QTY_EPS &&
        state.knownQty + QTY_EPS >= tx.quantity &&
        state.knownQty > QTY_EPS;
      const proceedsKnown = tx.valueUsd != null && Number.isFinite(tx.valueUsd);
      if (covered && proceedsKnown) {
        const avg = state.knownCost / state.knownQty;
        const disposedCost = round2(avg * tx.quantity);
        state.realizedPnl = round2(state.realizedPnl + (tx.valueUsd as number) - disposedCost);
        reduceUnknownThenKnown(state, tx.quantity);
      } else {
        state.realizedReliable = false;
        reduceUnknownThenKnown(state, tx.quantity);
      }
    } else {
      reduceUnknownThenKnown(state, tx.quantity);
    }

    states.set(tx.mint, state);
  }

  let realized = 0;
  let realizedReliable = true;
  let anySale = false;
  for (const tx of chronological) {
    if (tx.type === "sell") anySale = true;
  }
  for (const state of states.values()) {
    realized = round2(realized + state.realizedPnl);
    if (!state.realizedReliable) realizedReliable = false;
  }

  return {
    byMint: states,
    realizedPnl: anySale ? (realizedReliable ? realized : null) : 0,
  };
}

export function positionCostFromState(
  state: MintCostState | undefined,
  currentQuantity: number,
  currentValue: number,
): PositionCostResult {
  if (!isPositiveQty(currentQuantity)) {
    return {
      remainingCostBasis: 0,
      unrealizedPnl: null,
      unrealizedPnlPercent: null,
    };
  }
  if (!state) {
    return {
      remainingCostBasis: null,
      unrealizedPnl: null,
      unrealizedPnlPercent: null,
    };
  }
  const unknown = state.unknownQty > QTY_EPS;
  const qtyGap = Math.abs(state.knownQty - currentQuantity);
  const covered =
    !unknown &&
    state.knownQty > QTY_EPS &&
    qtyGap <= Math.max(QTY_EPS, currentQuantity * 1e-6);

  if (!covered) {
    return {
      remainingCostBasis: null,
      unrealizedPnl: null,
      unrealizedPnlPercent: null,
    };
  }

  const remainingCostBasis = round2(
    (state.knownCost / state.knownQty) * currentQuantity,
  );
  const unrealizedPnl = round2(currentValue - remainingCostBasis);
  const unrealizedPnlPercent =
    remainingCostBasis > 0
      ? round2((unrealizedPnl / remainingCostBasis) * 100)
      : null;
  return { remainingCostBasis, unrealizedPnl, unrealizedPnlPercent };
}
