import { normalizeContractAddress } from "../types/prestocks.ts";
import type { WalletToken } from "../types/portfolio.ts";

if (typeof window !== "undefined") {
  throw new Error("Solana RPC is server-only");
}

const PUBLIC_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
];
const FETCH_MS = 12_000;
const MAX_ATTEMPTS = 3;
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export class SolanaRpcError extends Error {
  status: number | null;
  constructor(status: number | null, message = "Wallet lookup failed") {
    super(message);
    this.name = "SolanaRpcError";
    this.status = status;
  }
}


function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseTokenAccount(item: unknown): WalletToken | null {
  if (!item || typeof item !== "object") return null;
  const account = (item as { account?: unknown }).account;
  if (!account || typeof account !== "object") return null;
  const data = (account as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const parsed = (data as { parsed?: unknown }).parsed;
  if (!parsed || typeof parsed !== "object") return null;
  const info = (parsed as { info?: unknown }).info;
  if (!info || typeof info !== "object") return null;

  const mintRaw = (info as { mint?: unknown }).mint;
  const mint =
    typeof mintRaw === "string" ? normalizeContractAddress(mintRaw) : "";
  if (!mint) return null;

  const tokenAmount = (info as { tokenAmount?: unknown }).tokenAmount;
  if (!tokenAmount || typeof tokenAmount !== "object") return null;
  const amountInfo = tokenAmount as {
    amount?: unknown;
    decimals?: unknown;
    uiAmount?: unknown;
  };
  const amount = asNumber(amountInfo.amount);
  const decimals = asNumber(amountInfo.decimals) ?? 0;
  if (amount != null && amount > 0) {
    const quantity = decimals > 0 ? amount / 10 ** decimals : amount;
    if (Number.isFinite(quantity) && quantity > 0) return { mint, quantity };
  }
  const ui = asNumber(amountInfo.uiAmount);
  if (ui != null && ui > 0) return { mint, quantity: ui };
  return null;
}

function tokensFromRpcResult(result: unknown): WalletToken[] {
  if (!result || typeof result !== "object") return [];
  const value = (result as { value?: unknown }).value;
  if (!Array.isArray(value)) return [];
  const tokens: WalletToken[] = [];
  for (const item of value) {
    const parsed = parseTokenAccount(item);
    if (parsed) tokens.push(parsed);
  }
  return tokens;
}

async function postJson(payload: unknown): Promise<{ status: number; body: unknown }> {
  let lastError: SolanaRpcError | null = null;
  for (const url of PUBLIC_RPCS) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(FETCH_MS),
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      lastError = new SolanaRpcError(
        null,
        timedOut
          ? "Wallet lookup timed out"
          : "Wallet lookup network request failed",
      );
      continue;
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }
  throw lastError ?? new SolanaRpcError(null, "Wallet lookup network request failed");
}

function isRateLimited(status: number, body: unknown) {
  if (status === 429) return true;
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const error = (body as { error?: { code?: unknown; message?: unknown } }).error;
  if (!error || typeof error !== "object") return false;
  if (error.code === 429) return true;
  const message = typeof error.message === "string" ? error.message : "";
  return /too many requests|rate limit/i.test(message);
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const payload = { jsonrpc: "2.0", id: "prelaunch-portfolio", method, params };
  let lastStatus: number | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const { status, body } = await postJson(payload);
    lastStatus = status;
    if (isRateLimited(status, body)) {
      await sleep(700 * (attempt + 1));
      continue;
    }
    if (status < 200 || status >= 300 || body == null) {
      throw new SolanaRpcError(status, "Unable to read this wallet right now.");
    }
    if (typeof body === "object" && (body as { error?: unknown }).error) {
      if (isRateLimited(200, body)) {
        await sleep(700 * (attempt + 1));
        continue;
      }
      throw new SolanaRpcError(status, "Unable to read this wallet right now.");
    }
    return (body as { result?: unknown }).result;
  }
  throw new SolanaRpcError(lastStatus, "Unable to read this wallet right now.");
}

export async function fetchFungiblesByMints(
  ownerAddress: string,
  mints: string[],
): Promise<WalletToken[]> {
  const wanted = new Set(
    mints.map((mint) => normalizeContractAddress(mint)).filter(Boolean),
  );
  if (wanted.size === 0) return [];

  const tokens: WalletToken[] = [];
  const result = await rpc("getTokenAccountsByOwner", [
    ownerAddress,
    { programId: TOKEN_2022_PROGRAM },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  for (const token of tokensFromRpcResult(result)) {
    if (wanted.has(token.mint)) tokens.push(token);
  }

  return tokens;
}

export type OpenTokenAccount = { address: string; mint: string };

/** Parse a jsonParsed getTokenAccountsByOwner row into address + mint (any balance). */
export function parseOpenTokenAccount(item: unknown): OpenTokenAccount | null {
  if (!item || typeof item !== "object") return null;
  const address = (item as { pubkey?: unknown }).pubkey;
  if (typeof address !== "string" || !address.trim()) return null;
  const account = (item as { account?: unknown }).account;
  const data = account && typeof account === "object" ? (account as { data?: unknown }).data : null;
  const parsed = data && typeof data === "object" ? (data as { parsed?: unknown }).parsed : null;
  const info = parsed && typeof parsed === "object" ? (parsed as { info?: unknown }).info : null;
  const mint = info && typeof info === "object" ? (info as { mint?: unknown }).mint : null;
  if (typeof mint !== "string" || !mint.trim()) return null;
  return { address: address.trim(), mint: normalizeContractAddress(mint) };
}

export function openTokenAccountsFromResult(result: unknown): OpenTokenAccount[] {
  if (!result || typeof result !== "object") return [];
  const value = (result as { value?: unknown }).value;
  if (!Array.isArray(value)) return [];
  const accounts: OpenTokenAccount[] = [];
  for (const item of value) {
    const parsed = parseOpenTokenAccount(item);
    if (parsed) accounts.push(parsed);
  }
  return accounts;
}

/** Every open Token-2022 account of the owner (including zero balances). */
export async function fetchOpenTokenAccounts(ownerAddress: string): Promise<OpenTokenAccount[]> {
  const result = await rpc("getTokenAccountsByOwner", [
    ownerAddress,
    { programId: TOKEN_2022_PROGRAM },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  return openTokenAccountsFromResult(result);
}

/** Public-RPC budget: signatures per token account and parsed transactions overall. */
const HISTORY_SIG_LIMIT = 100;
const HISTORY_TX_BUDGET = 80;
const HISTORY_TX_CONCURRENCY = 2;

/**
 * Parsed history for a set of token accounts (not the whole wallet) via
 * getSignaturesForAddress + getTransaction. Returns raw rows in the enhanced
 * shape and the mints whose history could not be read completely.
 */
export async function fetchParsedHistoryForAccounts(
  ownerAddress: string,
  accounts: { address: string; mint: string }[],
): Promise<{ raw: unknown[]; truncatedMints: string[]; pages: number }> {
  const { fromParsedRpcTransaction } = await import("./helius-history.ts");
  const truncated = new Set<string>();
  const wanted: { signature: string; mint: string }[] = [];
  const seen = new Set<string>();
  let pages = 0;

  for (const account of accounts) {
    const signatures = await rpc("getSignaturesForAddress", [
      account.address,
      { limit: HISTORY_SIG_LIMIT, commitment: "confirmed" },
    ]);
    pages += 1;
    if (!Array.isArray(signatures)) {
      throw new SolanaRpcError(200, "Unable to read this wallet right now.");
    }
    if (signatures.length >= HISTORY_SIG_LIMIT) truncated.add(account.mint);
    for (const item of signatures) {
      if (!item || typeof item !== "object") continue;
      const row = item as { signature?: unknown; err?: unknown };
      if (row.err) continue;
      if (typeof row.signature !== "string" || !row.signature.trim()) continue;
      const signature = row.signature.trim();
      if (seen.has(signature)) continue;
      seen.add(signature);
      wanted.push({ signature, mint: account.mint });
    }
  }

  // Over budget: the oldest rows are dropped, so those mints are incomplete.
  for (const item of wanted.slice(HISTORY_TX_BUDGET)) truncated.add(item.mint);
  const selected = wanted.slice(0, HISTORY_TX_BUDGET);

  const parsed: unknown[] = [];
  for (let i = 0; i < selected.length; i += HISTORY_TX_CONCURRENCY) {
    const slice = selected.slice(i, i + HISTORY_TX_CONCURRENCY);
    const batch = await Promise.all(
      slice.map(async ({ signature, mint }) => {
        try {
          return await rpc("getTransaction", [
            signature,
            {
              encoding: "jsonParsed",
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed",
            },
          ]);
        } catch {
          truncated.add(mint);
          return null;
        }
      }),
    );
    for (const item of batch) {
      const normalized = fromParsedRpcTransaction(item, ownerAddress);
      if (normalized) parsed.push(normalized);
    }
  }

  return { raw: parsed, truncatedMints: [...truncated], pages };
}
