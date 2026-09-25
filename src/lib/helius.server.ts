import { env } from "@/lib/env.server";
import {
  fetchFungiblesByMints,
  fetchOpenTokenAccounts,
  fetchParsedHistoryForAccounts,
  openTokenAccountsFromResult,
  SolanaRpcError,
  type OpenTokenAccount,
} from "@/lib/solana-rpc.server";
import {
  mergeBySignature,
  preStockHistoryAccounts,
  selectSignatures,
  TOKEN_2022_PROGRAM,
  type PreStockTokenAccount,
} from "@/lib/token-accounts";
import { normalizeContractAddress } from "@/types/prestocks";
import type { WalletToken } from "@/types/portfolio";

if (typeof window !== "undefined") {
  throw new Error("Helius is server-only");
}

const HELIUS_RPC = "https://mainnet.helius-rpc.com";
const PAGE_SIZE = 1000;
const MAX_PAGES = 5;
const CACHE_MS = 30_000;
const RPC_RETRIES = 3;

type CacheEntry = { at: number; result: WalletFetchResult };
const cache = new Map<string, CacheEntry>();

export type WalletFetchResult = {
  tokens: WalletToken[];
  assetCount: number;
  fungibleCount: number;
};

export class HeliusConfigError extends Error {
  readonly error = "HELIUS_CONFIG_MISSING" as const;
  constructor() {
    super("Helius API key is not configured on the server");
    this.name = "HeliusConfigError";
  }
}

export class HeliusAuthError extends Error {
  readonly error = "HELIUS_AUTH_ERROR" as const;
  constructor() {
    super("Helius API authentication failed");
    this.name = "HeliusAuthError";
  }
}

export class HeliusRequestError extends Error {
  readonly error = "HELIUS_REQUEST_FAILED" as const;
  status: number | null;
  rpcMessage: string;
  constructor(status: number | null, rpcMessage = "Helius request failed") {
    super(rpcMessage);
    this.name = "HeliusRequestError";
    this.status = status;
    this.rpcMessage = rpcMessage;
  }
}


function heliusKey() {
  return env("HELIUS_API_KEY");
}

export function isHeliusConfigured() {
  return Boolean(heliusKey());
}

function rpcUrl() {
  const key = heliusKey();
  if (!key) return null;
  return `${HELIUS_RPC}/?api-key=${encodeURIComponent(key)}`;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function rpcMessage(error: unknown) {
  let text = "";
  if (typeof error === "string" && error.trim()) text = error.trim();
  else if (error && typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown };
    const parts: string[] = [];
    if (typeof record.code === "number" || typeof record.code === "string") {
      parts.push(String(record.code));
    }
    if (typeof record.message === "string" && record.message.trim()) {
      parts.push(record.message.trim());
    }
    text = parts.join(" ");
  }
  return text
    .replace(/api-key=[^&\s]+/gi, "api-key=redacted")
    .slice(0, 200);
}

function extractMint(record: Record<string, unknown>) {
  const info = record.token_info;
  if (info && typeof info === "object") {
    const mint = (info as Record<string, unknown>).mint;
    if (typeof mint === "string" && mint.trim()) {
      return normalizeContractAddress(mint);
    }
  }
  if (typeof record.id === "string" && record.id.trim()) {
    return normalizeContractAddress(record.id);
  }
  return "";
}

function extractQuantity(token: Record<string, unknown>) {
  const nested = token.token_amount;
  if (nested && typeof nested === "object") {
    const amountInfo = nested as Record<string, unknown>;
    const ui = asNumber(amountInfo.uiAmount);
    if (ui != null && ui > 0) return ui;
    const amount = asNumber(amountInfo.amount);
    const nestedDecimals = asNumber(amountInfo.decimals) ?? 0;
    if (amount != null && amount > 0) {
      return nestedDecimals > 0 ? amount / 10 ** nestedDecimals : amount;
    }
  }
  const raw = asNumber(token.balance);
  if (raw == null || raw <= 0) return null;
  const decimals = asNumber(token.decimals) ?? 0;
  const quantity = decimals > 0 ? raw / 10 ** decimals : raw;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return quantity;
}

function parseFungible(item: unknown): WalletToken | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const iface = record.interface;
  if (
    typeof iface === "string" &&
    iface !== "FungibleToken" &&
    iface !== "FungibleAsset"
  ) {
    return null;
  }
  const info = record.token_info;
  if (!info || typeof info !== "object") return null;
  const mint = extractMint(record);
  if (!mint) return null;
  const quantity = extractQuantity(info as Record<string, unknown>);
  if (quantity == null) return null;
  return { mint, quantity };
}

type RpcOk = { status: number; result: unknown };

async function rpc(
  method: string,
  params: Record<string, unknown> | unknown[],
): Promise<RpcOk> {
  const url = rpcUrl();
  if (!url) throw new HeliusConfigError();

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "prelaunch-portfolio",
          method,
          params,
        }),
      });
    } catch {
      throw new HeliusRequestError(null, "Helius network request failed");
    }

    // Rate limited: back off and retry a few times before failing over.
    if (response.status === 429 && attempt < RPC_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      continue;
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const body =
      payload && typeof payload === "object"
        ? (payload as { error?: unknown; result?: unknown })
        : null;
    const errorText = rpcMessage(body?.error);

    if (response.status === 401 || response.status === 403) {
      throw new HeliusAuthError();
    }
    if (!response.ok) {
      throw new HeliusRequestError(
        response.status,
        errorText || `Helius HTTP ${response.status}`,
      );
    }
    if (!body) throw new HeliusRequestError(response.status, "Helius returned invalid JSON");
    if (body.error) {
      throw new HeliusRequestError(
        response.status,
        errorText || "Helius RPC error",
      );
    }
    return { status: response.status, result: body.result };
  }
}

type RpcPage = {
  items?: unknown;
  total?: unknown;
};

async function collectPages(
  method: string,
  base: Record<string, unknown>,
): Promise<WalletFetchResult> {
  const tokens: WalletToken[] = [];
  let assetCount = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { result } = await rpc(method, { ...base, page, limit: PAGE_SIZE });
    if (!result || typeof result !== "object") {
      throw new HeliusRequestError(200, "Helius result missing");
    }
    const pageResult = result as RpcPage;
    const items = Array.isArray(pageResult.items) ? pageResult.items : null;
    if (!items) throw new HeliusRequestError(200, "Helius items missing");
    assetCount += items.length;

    for (const item of items) {
      const parsed = parseFungible(item);
      if (parsed) tokens.push(parsed);
    }
    if (items.length < PAGE_SIZE) break;
    const total = asNumber(pageResult.total);
    if (total != null && page * PAGE_SIZE >= total) break;
  }

  return { tokens, assetCount, fungibleCount: tokens.length };
}

const FUNGIBLE_OPTIONS = {
  showFungible: true,
  showZeroBalance: false,
  showNativeBalance: false,
};

async function fetchFromHelius(ownerAddress: string): Promise<WalletFetchResult> {
  let result: WalletFetchResult;
  try {
    result = await collectPages("getAssetsByOwner", {
      ownerAddress,
      displayOptions: FUNGIBLE_OPTIONS,
      options: FUNGIBLE_OPTIONS,
    });
  } catch (error) {
    if (
      error instanceof HeliusConfigError ||
      error instanceof HeliusAuthError
    ) {
      throw error;
    }
    result = await collectPages("searchAssets", {
      ownerAddress,
      tokenType: "fungible",
    });
  }

  if (result.fungibleCount === 0 && result.assetCount > 0) {
    try {
      const searched = await collectPages("searchAssets", {
        ownerAddress,
        tokenType: "fungible",
      });
      if (searched.fungibleCount > 0) result = searched;
    } catch {
      // Keep getAssetsByOwner result when the fungible search also fails.
    }
  }

  return result;
}

async function fetchFromPublicRpc(
  ownerAddress: string,
  mints: string[],
): Promise<WalletFetchResult> {
  try {
    const tokens = await fetchFungiblesByMints(ownerAddress, mints);
    return {
      tokens,
      assetCount: tokens.length,
      fungibleCount: tokens.length,
    };
  } catch (error) {
    if (error instanceof SolanaRpcError) {
      throw new HeliusRequestError(
        error.status,
        error.message || "Unable to read this wallet right now.",
      );
    }
    throw error;
  }
}

export async function fetchWalletFungibles(
  ownerAddress: string,
  options?: { fresh?: boolean; mints?: string[] },
): Promise<WalletFetchResult> {
  const mints = options?.mints ?? [];

  if (!options?.fresh) {
    const cached = cache.get(ownerAddress);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return cached.result;
    }
  }

  let result: WalletFetchResult | null = null;
  if (heliusKey()) {
    try {
      result = await fetchFromHelius(ownerAddress);
    } catch {
      // Any Helius failure falls through to the public RPC below.
      result = null;
    }
  }

  if (!result) {
    result = await fetchFromPublicRpc(ownerAddress, mints);
  }

  cache.set(ownerAddress, { at: Date.now(), result });
  return result;
}

/** Signatures read per PreStock token account (one RPC page). */
const HISTORY_SIGNATURES_PER_ACCOUNT = 1000;
/** Enhanced Transactions parse batch size (API maximum). */
const PARSE_BATCH = 100;
const PARSE_CONCURRENCY = 2;
/**
 * Total signatures parsed per wallet. Accounts are read smallest-first; an
 * account over the cap (or over 1,000 signatures) only has its newest page
 * parsed for display and its mint is reported as partial (no cost basis).
 */
const MAX_PARSED_SIGNATURES = 1500;
const RECENT_ONLY = 100;
const MAX_RETRIES = 4;
const HISTORY_CACHE_MS = 30_000;
const ENHANCED_HOSTS = ["https://api-mainnet.helius-rpc.com", HELIUS_RPC];

type HistoryCacheEntry = { at: number; result: HistoryFetchResult };
const historyCache = new Map<string, HistoryCacheEntry>();

export type HistoryFetchResult = {
  raw: unknown[];
  /** True when any PreStock account's history was not read completely. */
  truncated: boolean;
  /** Catalog mints whose token-account history is incomplete. */
  truncatedMints: string[];
  /** Token accounts whose history was requested. */
  accounts: number;
  pages: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Successful signatures for one token account (newest first, one page). */
async function accountSignatures(address: string) {
  const { result } = await rpc("getSignaturesForAddress", [
    address,
    { limit: HISTORY_SIGNATURES_PER_ACCOUNT, commitment: "confirmed" },
  ]);
  if (!Array.isArray(result)) throw new HeliusRequestError(200, "Helius signatures missing");
  const signatures: string[] = [];
  for (const item of result) {
    if (!item || typeof item !== "object") continue;
    const row = item as { signature?: unknown; err?: unknown };
    if (row.err || typeof row.signature !== "string" || !row.signature.trim()) continue;
    signatures.push(row.signature.trim());
  }
  return { signatures, truncated: result.length >= HISTORY_SIGNATURES_PER_ACCOUNT };
}

/** Parse up to 100 signatures with Helius Enhanced Transactions (POST /v0/transactions). */
async function parseTransactions(signatures: string[]): Promise<unknown[]> {
  const key = heliusKey();
  if (!key) throw new HeliusConfigError();
  let lastStatus: number | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const host = ENHANCED_HOSTS[attempt % ENHANCED_HOSTS.length];
    let response: Response;
    try {
      response = await fetch(`${host}/v0/transactions?api-key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: signatures }),
      });
    } catch {
      lastStatus = null;
      await sleep(400 * (attempt + 1));
      continue;
    }
    lastStatus = response.status;
    if (response.status === 401 || response.status === 403) throw new HeliusAuthError();
    if (response.status === 429 || response.status >= 500 || response.status === 404) {
      await sleep(600 * (attempt + 1));
      continue;
    }
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const errorText =
        payload && typeof payload === "object"
          ? rpcMessage((payload as { error?: unknown }).error)
          : "";
      throw new HeliusRequestError(response.status, errorText || `Helius HTTP ${response.status}`);
    }
    if (Array.isArray(payload)) return payload;
    throw new HeliusRequestError(response.status, "Helius returned invalid JSON");
  }
  throw new HeliusRequestError(lastStatus, `Helius HTTP ${lastStatus ?? "network error"}`);
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Open Token-2022 accounts (any balance): Helius RPC first, public RPC fallback. */
async function fetchOpenAccounts(ownerAddress: string): Promise<OpenTokenAccount[]> {
  if (heliusKey()) {
    try {
      const { result } = await rpc("getTokenAccountsByOwner", [
        ownerAddress,
        { programId: TOKEN_2022_PROGRAM },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]);
      return openTokenAccountsFromResult(result);
    } catch (error) {
      if (error instanceof HeliusAuthError) throw error;
      // Fall through to public RPC.
    }
  }
  return fetchOpenTokenAccounts(ownerAddress);
}

async function historyFromHelius(
  accounts: PreStockTokenAccount[],
): Promise<HistoryFetchResult> {
  const truncatedMints = new Set<string>();
  // Signature lookups are cheap standard RPC calls; accounts that never
  // existed (e.g. an unused derived ATA) return an empty list.
  const lists = await mapLimited(accounts, 4, (account) => accountSignatures(account.address));
  const plan = selectSignatures(
    lists.map((list, index) => ({ ...list, mint: accounts[index].mint })),
    MAX_PARSED_SIGNATURES,
    RECENT_ONLY,
  );
  for (const mint of plan.truncatedMints) truncatedMints.add(mint);
  const signatures = plan.signatures;

  const batches: string[][] = [];
  for (let i = 0; i < signatures.length; i += PARSE_BATCH) {
    batches.push(signatures.slice(i, i + PARSE_BATCH));
  }
  const parsed = await mapLimited(batches, PARSE_CONCURRENCY, parseTransactions);

  return {
    raw: mergeBySignature(parsed),
    truncated: truncatedMints.size > 0,
    truncatedMints: [...truncatedMints],
    accounts: accounts.length,
    pages: accounts.length + batches.length,
  };
}

/**
 * PreStock history scoped to the wallet's PreStock token accounts — each
 * open Token-2022 account for a catalog mint plus the derived associated
 * token account per catalog mint — instead of the wallet's full transaction
 * history, so unrelated activity cannot push PreStock trades past the cap.
 */
export async function fetchWalletHistory(
  ownerAddress: string,
  options?: { fresh?: boolean; mints?: string[] },
): Promise<HistoryFetchResult> {
  if (!options?.fresh) {
    const cached = historyCache.get(ownerAddress);
    if (cached && Date.now() - cached.at < HISTORY_CACHE_MS) {
      return cached.result;
    }
  }

  let open: OpenTokenAccount[];
  try {
    open = await fetchOpenAccounts(ownerAddress);
  } catch (error) {
    if (error instanceof SolanaRpcError) {
      throw new HeliusRequestError(error.status, error.message || "Unable to load transaction history.");
    }
    throw error;
  }
  const accounts = preStockHistoryAccounts(ownerAddress, open, options?.mints ?? []);

  let result: HistoryFetchResult | null = null;
  if (heliusKey()) {
    try {
      result = await historyFromHelius(accounts);
    } catch {
      // Any Helius failure falls through to the public RPC below.
      result = null;
    }
  }

  if (!result) {
    // Public RPC is rate-limited: bounded signatures per account and a
    // total transaction budget; anything beyond it marks that mint partial.
    try {
      const publicHistory = await fetchParsedHistoryForAccounts(ownerAddress, accounts);
      result = {
        raw: publicHistory.raw,
        truncated: publicHistory.truncatedMints.length > 0,
        truncatedMints: publicHistory.truncatedMints,
        accounts: accounts.length,
        pages: publicHistory.pages,
      };
    } catch (error) {
      if (error instanceof SolanaRpcError) {
        throw new HeliusRequestError(
          error.status,
          error.message || "Unable to load transaction history.",
        );
      }
      throw error;
    }
  }

  historyCache.set(ownerAddress, { at: Date.now(), result });
  return result;
}
