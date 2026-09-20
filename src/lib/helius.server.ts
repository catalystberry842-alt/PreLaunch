import { env } from "@/lib/env.server";
import { fetchFungiblesByMints, fetchParsedHistory, SolanaRpcError } from "@/lib/solana-rpc.server";
import { normalizeContractAddress } from "@/types/prestocks";
import type { WalletToken } from "@/types/portfolio";

if (typeof window !== "undefined") {
  throw new Error("Helius is server-only");
}

const HELIUS_RPC = "https://mainnet.helius-rpc.com";
const PAGE_SIZE = 1000;
const MAX_PAGES = 5;
const CACHE_MS = 30_000;

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

function log(_event: string, _data: Record<string, unknown>) {
  return;
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
  params: Record<string, unknown>,
): Promise<RpcOk> {
  const url = rpcUrl();
  if (!url) throw new HeliusConfigError();

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
    log("helius http", { method, status: 0, error: "network" });
    throw new HeliusRequestError(null, "Helius network request failed");
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

  log("helius http", {
    method,
    status: response.status,
    error: errorText || null,
  });

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
  let loggedSample = false;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { result } = await rpc(method, { ...base, page, limit: PAGE_SIZE });
    if (!result || typeof result !== "object") {
      throw new HeliusRequestError(200, "Helius result missing");
    }
    const pageResult = result as RpcPage;
    const items = Array.isArray(pageResult.items) ? pageResult.items : null;
    if (!items) throw new HeliusRequestError(200, "Helius items missing");
    assetCount += items.length;

    if (!loggedSample && items[0] && typeof items[0] === "object") {
      loggedSample = true;
      const sample = items[0] as Record<string, unknown>;
      const info =
        sample.token_info && typeof sample.token_info === "object"
          ? (sample.token_info as Record<string, unknown>)
          : null;
      log("helius sample", {
        keys: Object.keys(sample),
        interface: typeof sample.interface === "string" ? sample.interface : null,
        hasTokenInfo: Boolean(info),
        tokenInfoKeys: info ? Object.keys(info) : [],
      });
    }

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
    log("helius fallback", { method: "searchAssets" });
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

  log("helius assets", {
    assetCount: result.assetCount,
    fungibleCount: result.fungibleCount,
  });
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
      log("helius cache", {
        assetCount: cached.result.assetCount,
        fungibleCount: cached.result.fungibleCount,
      });
      return cached.result;
    }
  }

  let result: WalletFetchResult | null = null;
  if (heliusKey()) {
    try {
      result = await fetchFromHelius(ownerAddress);
    } catch (error) {
      log("helius fallback", {
        reason:
          error instanceof Error ? error.name : "helius_failed",
      });
    }
  }

  if (!result) {
    result = await fetchFromPublicRpc(ownerAddress, mints);
  }

  cache.set(ownerAddress, { at: Date.now(), result });
  return result;
}

const HISTORY_PAGE = 100;
const HISTORY_MAX_PAGES = 6;
const HISTORY_CACHE_MS = 30_000;

type HistoryCacheEntry = { at: number; result: HistoryFetchResult };
const historyCache = new Map<string, HistoryCacheEntry>();

export type HistoryFetchResult = {
  raw: unknown[];
  truncated: boolean;
  pages: number;
};

function historyUrl(ownerAddress: string, before?: string, extras?: { tokenAccounts?: boolean; host?: string }) {
  const key = heliusKey();
  if (!key) throw new HeliusConfigError();
  const params = new URLSearchParams({
    "api-key": key,
    limit: String(HISTORY_PAGE),
    "sort-order": "desc",
  });
  if (extras?.tokenAccounts !== false) params.set("token-accounts", "balanceChanged");
  if (before) params.set("before-signature", before);
  const host = extras?.host ?? HELIUS_RPC;
  return `${host}/v0/addresses/${encodeURIComponent(ownerAddress)}/transactions?${params.toString()}`;
}

async function fetchHistoryPage(
  ownerAddress: string,
  before?: string,
  extras?: { tokenAccounts?: boolean; host?: string },
) {
  let response: Response;
  try {
    response = await fetch(historyUrl(ownerAddress, before, extras), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch {
    log("helius http", { method: "txHistory", status: 0, error: "network" });
    throw new HeliusRequestError(null, "Helius network request failed");
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const errorText =
    payload && typeof payload === "object"
      ? rpcMessage((payload as { error?: unknown }).error)
      : "";

  log("helius http", {
    method: "txHistory",
    status: response.status,
    error: errorText || null,
  });

  if (response.status === 401 || response.status === 403) {
    throw new HeliusAuthError();
  }
  if (response.status === 404 && extras?.host !== "https://api-mainnet.helius-rpc.com") {
    return fetchHistoryPage(ownerAddress, before, {
      ...extras,
      host: "https://api-mainnet.helius-rpc.com",
    });
  }
  if (response.status === 400 && extras?.tokenAccounts !== false) {
    return fetchHistoryPage(ownerAddress, before, {
      ...extras,
      tokenAccounts: false,
    });
  }
  if (!response.ok) {
    throw new HeliusRequestError(
      response.status,
      errorText || `Helius HTTP ${response.status}`,
    );
  }
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as { error?: unknown; result?: unknown };
    if (record.error) {
      throw new HeliusRequestError(response.status, errorText || "Helius RPC error");
    }
    if (Array.isArray(record.result)) return record.result;
  }
  throw new HeliusRequestError(response.status, "Helius returned invalid JSON");
}

export async function fetchWalletHistory(
  ownerAddress: string,
  options?: { fresh?: boolean },
): Promise<HistoryFetchResult> {
  if (!options?.fresh) {
    const cached = historyCache.get(ownerAddress);
    if (cached && Date.now() - cached.at < HISTORY_CACHE_MS) {
      log("helius cache", { historyPages: cached.result.pages, tx: cached.result.raw.length });
      return cached.result;
    }
  }

  let result: HistoryFetchResult | null = null;
  if (heliusKey()) {
    try {
      const raw: unknown[] = [];
      let before: string | undefined;
      let truncated = false;
      let pages = 0;

      for (let page = 1; page <= HISTORY_MAX_PAGES; page += 1) {
        const batch = await fetchHistoryPage(ownerAddress, before);
        pages = page;
        if (batch.length === 0) break;
        raw.push(...batch);
        if (batch.length < HISTORY_PAGE) break;
        const last = batch[batch.length - 1];
        const signature =
          last && typeof last === "object"
            ? (last as { signature?: unknown }).signature
            : null;
        if (typeof signature !== "string" || !signature.trim()) break;
        before = signature.trim();
        if (page === HISTORY_MAX_PAGES) truncated = true;
      }

      result = { raw, truncated, pages };
      log("helius history", { pages, tx: raw.length, truncated });
    } catch (error) {
      log("helius fallback", {
        reason: error instanceof Error ? error.name : "helius_history_failed",
      });
    }
  }

  if (!result) {
    try {
      const publicHistory = await fetchParsedHistory(ownerAddress);
      result = {
        raw: publicHistory.raw,
        truncated: publicHistory.truncated,
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
