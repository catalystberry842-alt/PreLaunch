import { round2 } from "./format.ts";
import { normalizeContractAddress } from "../types/prestocks.ts";
import type { PreStock } from "./types.ts";
import type { PortfolioTransaction, PortfolioTxType } from "../types/portfolio.ts";

/** Circle USDC and Tether USDT on Solana mainnet — treated as $1. */
const STABLE_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);

const QTY_EPS = 1e-8;
/** Intermediate route legs (e.g. wrapped SOL) must net to ~0 for the wallet. */
const ROUTE_EPS = 1e-6;
/**
 * Native SOL the wallet may spend in a priced trade without affecting cost:
 * network fees and token-account rent (0.02 SOL). A larger SOL leg means the
 * trade was not paid purely in stablecoins, so no USD value is attributed.
 */
const NATIVE_FEE_LAMPORTS = 20_000_000;

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function tokenQty(record: Record<string, unknown>) {
  const direct =
    asNumber(record.tokenAmount) ??
    asNumber(record.uiAmount) ??
    asNumber(record.amount);
  if (direct != null && Math.abs(direct) > 0) return Math.abs(direct);
  const raw = record.rawTokenAmount;
  if (raw && typeof raw === "object") {
    const info = raw as Record<string, unknown>;
    const amount = asNumber(info.tokenAmount) ?? asNumber(info.amount);
    const decimals = asNumber(info.decimals) ?? 0;
    if (amount != null && amount > 0) {
      return decimals > 0 ? amount / 10 ** decimals : amount;
    }
  }
  return null;
}

function isoFromUnix(value: unknown) {
  const seconds = asNumber(value);
  if (seconds == null || seconds <= 0) return null;
  const ms = seconds > 1e12 ? seconds : seconds * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function typeLabel(type: PortfolioTxType, _eligible: boolean): string {
  if (type === "buy") return "Buy / Acquisition";
  if (type === "sell") return "Sell / Disposal";
  if (type === "transfer_in") return "Transfer in";
  if (type === "transfer_out") return "Transfer out";
  return "Transfer";
}

function catalogByMint(stocks: PreStock[]) {
  const map = new Map<string, PreStock>();
  for (const stock of stocks) {
    const mint = normalizeContractAddress(stock.contractAddress);
    if (!mint || map.has(mint)) continue;
    map.set(mint, stock);
  }
  return map;
}

function collectTransfers(tx: Record<string, unknown>) {
  const list: { mint: string; from: string; to: string; quantity: number }[] = [];
  const rows = Array.isArray(tx.tokenTransfers) ? tx.tokenTransfers : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const mint = normalizeContractAddress(asString(record.mint));
    if (!mint) continue;
    const quantity = tokenQty(record);
    if (quantity == null || quantity <= QTY_EPS) continue;
    list.push({
      mint,
      from: asString(record.fromUserAccount),
      to: asString(record.toUserAccount),
      quantity,
    });
  }

  const events = tx.events && typeof tx.events === "object"
    ? (tx.events as Record<string, unknown>)
    : null;
  const swap = events?.swap && typeof events.swap === "object"
    ? (events.swap as Record<string, unknown>)
    : null;
  if (swap && list.length === 0) {
    const pushLegs = (legs: unknown, inbound: boolean) => {
      if (!Array.isArray(legs)) return;
      for (const leg of legs) {
        if (!leg || typeof leg !== "object") continue;
        const record = leg as Record<string, unknown>;
        const mint = normalizeContractAddress(asString(record.mint));
        const quantity = tokenQty(record);
        const account = asString(record.userAccount);
        if (!mint || quantity == null) continue;
        list.push({
          mint,
          from: inbound ? "" : account,
          to: inbound ? account : "",
          quantity,
        });
      }
    };
    pushLegs(swap.tokenInputs, false);
    pushLegs(swap.tokenOutputs, true);
  }

  return { list, isSwap: Boolean(swap) || asString(tx.type).toUpperCase() === "SWAP" };
}

/** Wallet's native SOL change in lamports (Helius accountData, else nativeTransfers). */
function nativeNetLamports(tx: Record<string, unknown>, wallet: string): number {
  if (Array.isArray(tx.accountData)) {
    for (const row of tx.accountData) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      if (asString(record.account) !== wallet) continue;
      const change = asNumber(record.nativeBalanceChange);
      if (change != null) return change;
    }
  }
  let net = 0;
  const rows = Array.isArray(tx.nativeTransfers) ? tx.nativeTransfers : [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const amount = asNumber(record.amount);
    if (amount == null) continue;
    const from = asString(record.fromUserAccount);
    const to = asString(record.toUserAccount);
    if (to === wallet && from !== wallet) net += amount;
    if (from === wallet && to !== wallet) net -= amount;
  }
  return net;
}

/**
 * Net token change per mint for the wallet from Helius `accountData[].
 * tokenBalanceChanges` — actual balance deltas. PreStock mints carry a
 * Token-2022 transfer fee, so the amount a recipient receives is less than the
 * transfer amount; balance deltas reflect what the wallet really gained or
 * lost. Returns null when the transaction has no balance-change data.
 */
function balanceChangeNets(tx: Record<string, unknown>, wallet: string) {
  if (!Array.isArray(tx.accountData)) return null;
  let hasData = false;
  const nets = new Map<string, number>();
  for (const row of tx.accountData) {
    if (!row || typeof row !== "object") continue;
    const changes = (row as Record<string, unknown>).tokenBalanceChanges;
    if (!Array.isArray(changes)) continue;
    hasData = true;
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const record = change as Record<string, unknown>;
      if (asString(record.userAccount) !== wallet) continue;
      const mint = normalizeContractAddress(asString(record.mint));
      const raw =
        record.rawTokenAmount && typeof record.rawTokenAmount === "object"
          ? (record.rawTokenAmount as Record<string, unknown>)
          : null;
      const amount = raw ? asNumber(raw.tokenAmount) : null;
      const decimals = raw ? (asNumber(raw.decimals) ?? 0) : 0;
      if (!mint || amount == null || amount === 0) continue;
      const quantity = decimals > 0 ? amount / 10 ** decimals : amount;
      nets.set(mint, (nets.get(mint) ?? 0) + quantity);
    }
  }
  return hasData ? nets : null;
}

function netForWallet(
  rows: { mint: string; from: string; to: string; quantity: number }[],
  wallet: string,
) {
  const nets = new Map<string, number>();
  for (const row of rows) {
    let delta = 0;
    if (row.to === wallet && row.from !== wallet) delta += row.quantity;
    if (row.from === wallet && row.to !== wallet) delta -= row.quantity;
    if (delta === 0) continue;
    nets.set(row.mint, (nets.get(row.mint) ?? 0) + delta);
  }
  return nets;
}

export function parsePreStockTransactions(
  rawTransactions: unknown[],
  wallet: string,
  stocks: PreStock[],
): PortfolioTransaction[] {
  const owner = wallet.trim();
  if (!owner) return [];
  const catalog = catalogByMint(stocks);
  const results: PortfolioTransaction[] = [];

  for (const raw of rawTransactions) {
    if (!raw || typeof raw !== "object") continue;
    const tx = raw as Record<string, unknown>;
    const fromBalances = balanceChangeNets(tx, owner);
    let nets: Map<string, number>;
    if (fromBalances) {
      nets = fromBalances;
    } else {
      const { list } = collectTransfers(tx);
      if (list.length === 0) continue;
      nets = netForWallet(list, owner);
    }
    let stableNet = 0;
    let otherLegsNetZero = true;
    for (const [mint, net] of nets) {
      if (STABLE_MINTS.has(mint)) stableNet += net;
      else if (!catalog.has(mint) && Math.abs(net) > ROUTE_EPS) otherLegsNetZero = false;
    }

    const prestockMoves: { mint: string; net: number; stock: PreStock }[] = [];
    for (const [mint, net] of nets) {
      if (Math.abs(net) <= QTY_EPS) continue;
      const stock = catalog.get(mint);
      if (!stock) continue;
      prestockMoves.push({ mint, net, stock });
    }
    if (prestockMoves.length === 0) continue;

    const signature = asString(tx.signature) || null;
    const timestamp = isoFromUnix(tx.timestamp) ?? isoFromUnix(tx.blockTime);
    const nativeNet = nativeNetLamports(tx, owner);
    // USD is attributed only when, for this wallet, exactly one PreStock moved
    // and every other asset leg is stablecoins (routes through e.g. wrapped SOL
    // must net to zero). The Helius type label is not required: aggregator
    // routes are often labelled TRANSFER or UNKNOWN.
    const canAllocateUsd = prestockMoves.length === 1 && otherLegsNetZero;
    const usdFlow = canAllocateUsd ? stableNet : 0;

    for (const move of prestockMoves) {
      const inbound = move.net > 0;
      const quantity = Math.abs(move.net);
      let type: PortfolioTxType;
      let valueUsd: number | null = null;

      if (inbound && usdFlow < -QTY_EPS && nativeNet >= -NATIVE_FEE_LAMPORTS) {
        type = "buy";
        valueUsd = round2(-usdFlow);
      } else if (!inbound && usdFlow > QTY_EPS && nativeNet <= NATIVE_FEE_LAMPORTS) {
        type = "sell";
        valueUsd = round2(usdFlow);
      } else if (inbound) {
        type = "transfer_in";
      } else {
        type = "transfer_out";
      }

      const costBasisEligible =
        type === "buy" && valueUsd != null && valueUsd >= 0;
      const unitPriceUsd =
        valueUsd != null && quantity > 0 ? round2(valueUsd / quantity) : null;

      results.push({
        walletAddress: owner,
        signature,
        timestamp,
        mint: move.mint,
        symbol: move.stock.symbol,
        name: move.stock.name,
        quantity,
        direction: inbound ? "in" : "out",
        type,
        typeLabel: typeLabel(type, costBasisEligible),
        unitPriceUsd,
        valueUsd,
        costBasisEligible,
      });
    }
  }

  return results;
}

type TokenBalanceRow = {
  mint: string;
  owner: string;
  quantity: number;
};

function tokenBalanceRows(value: unknown): TokenBalanceRow[] {
  if (!Array.isArray(value)) return [];
  const rows: TokenBalanceRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const mint = normalizeContractAddress(asString(record.mint));
    const owner = asString(record.owner);
    if (!mint || !owner) continue;
    const amountInfo =
      record.uiTokenAmount && typeof record.uiTokenAmount === "object"
        ? (record.uiTokenAmount as Record<string, unknown>)
        : record;
    const quantity = tokenQty(amountInfo);
    rows.push({ mint, owner, quantity: quantity ?? 0 });
  }
  return rows;
}

function netOwned(rows: TokenBalanceRow[], wallet: string) {
  const nets = new Map<string, number>();
  for (const row of rows) {
    if (row.owner !== wallet) continue;
    nets.set(row.mint, (nets.get(row.mint) ?? 0) + row.quantity);
  }
  return nets;
}

function nativeChangeFromMeta(
  transaction: Record<string, unknown> | null,
  meta: Record<string, unknown>,
  owner: string,
): number | null {
  const message =
    transaction?.message && typeof transaction.message === "object"
      ? (transaction.message as Record<string, unknown>)
      : null;
  const keys = message && Array.isArray(message.accountKeys) ? message.accountKeys : [];
  const index = keys.findIndex((key) =>
    typeof key === "string"
      ? key === owner
      : key && typeof key === "object" && asString((key as { pubkey?: unknown }).pubkey) === owner,
  );
  if (index < 0) return null;
  const pre = Array.isArray(meta.preBalances) ? asNumber(meta.preBalances[index]) : null;
  const post = Array.isArray(meta.postBalances) ? asNumber(meta.postBalances[index]) : null;
  if (pre == null || post == null) return null;
  return post - pre;
}

/**
 * Convert a jsonParsed Solana RPC transaction into the enhanced-tx shape
 * that parsePreStockTransactions already understands.
 */
export function fromParsedRpcTransaction(raw: unknown, wallet: string) {
  const owner = wallet.trim();
  if (!raw || typeof raw !== "object" || !owner) return null;
  const tx = raw as Record<string, unknown>;
  const meta = tx.meta && typeof tx.meta === "object" ? (tx.meta as Record<string, unknown>) : null;
  if (!meta || meta.err) return null;

  const transaction =
    tx.transaction && typeof tx.transaction === "object"
      ? (tx.transaction as Record<string, unknown>)
      : null;
  const signatures = transaction && Array.isArray(transaction.signatures)
    ? transaction.signatures
    : [];
  const signature = asString(signatures[0]);
  if (!signature) return null;

  const before = netOwned(tokenBalanceRows(meta.preTokenBalances), owner);
  const after = netOwned(tokenBalanceRows(meta.postTokenBalances), owner);
  const mints = new Set([...before.keys(), ...after.keys()]);
  const tokenTransfers: {
    fromUserAccount: string;
    toUserAccount: string;
    mint: string;
    tokenAmount: number;
  }[] = [];

  for (const mint of mints) {
    const delta = (after.get(mint) ?? 0) - (before.get(mint) ?? 0);
    if (Math.abs(delta) <= QTY_EPS) continue;
    if (delta > 0) {
      tokenTransfers.push({
        fromUserAccount: "",
        toUserAccount: owner,
        mint,
        tokenAmount: delta,
      });
    } else {
      tokenTransfers.push({
        fromUserAccount: owner,
        toUserAccount: "",
        mint,
        tokenAmount: Math.abs(delta),
      });
    }
  }

  if (tokenTransfers.length === 0) return null;
  const distinct = new Set(tokenTransfers.map((item) => item.mint));
  const nativeBalanceChange = nativeChangeFromMeta(transaction, meta, owner);
  return {
    signature,
    timestamp: asNumber(tx.blockTime),
    type: distinct.size > 1 ? "SWAP" : "TRANSFER",
    tokenTransfers,
    accountData:
      nativeBalanceChange == null ? [] : [{ account: owner, nativeBalanceChange }],
  };
}
