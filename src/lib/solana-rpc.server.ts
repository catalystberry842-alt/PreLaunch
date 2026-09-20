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

function log(_event: string, _data: Record<string, unknown>) {
  return;
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
      log("rpc retry", { attempt, status: 429 });
      await sleep(700 * (attempt + 1));
      continue;
    }
    if (status < 200 || status >= 300 || body == null) {
      throw new SolanaRpcError(status, "Unable to read this wallet right now.");
    }
    if (typeof body === "object" && (body as { error?: unknown }).error) {
      if (isRateLimited(200, body)) {
        log("rpc retry", { attempt, status: 429 });
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

  log("rpc assets", {
    source: "public",
    mints: wanted.size,
    accounts: tokens.length,
  });
  return tokens;
}

const HISTORY_SIG_LIMIT = 40;
const HISTORY_TX_CONCURRENCY = 4;

export async function fetchParsedHistory(ownerAddress: string): Promise<{
  raw: unknown[];
  truncated: boolean;
  pages: number;
}> {
  const { fromParsedRpcTransaction } = await import("./helius-history.ts");
  const signatures = await rpc("getSignaturesForAddress", [
    ownerAddress,
    { limit: HISTORY_SIG_LIMIT, commitment: "confirmed" },
  ]);
  if (!Array.isArray(signatures)) {
    throw new SolanaRpcError(200, "Unable to read this wallet right now.");
  }

  const wanted: string[] = [];
  for (const item of signatures) {
    if (!item || typeof item !== "object") continue;
    const row = item as { signature?: unknown; err?: unknown };
    if (row.err) continue;
    if (typeof row.signature !== "string" || !row.signature.trim()) continue;
    wanted.push(row.signature.trim());
  }

  const parsed: unknown[] = [];
  for (let i = 0; i < wanted.length; i += HISTORY_TX_CONCURRENCY) {
    const slice = wanted.slice(i, i + HISTORY_TX_CONCURRENCY);
    const batch = await Promise.all(
      slice.map(async (signature) => {
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
          return null;
        }
      }),
    );
    for (const item of batch) {
      const normalized = fromParsedRpcTransaction(item, ownerAddress);
      if (normalized) parsed.push(normalized);
    }
  }

  const truncated = signatures.length >= HISTORY_SIG_LIMIT;
  log("rpc history", {
    signatures: wanted.length,
    parsed: parsed.length,
    truncated,
  });
  return { raw: parsed, truncated, pages: 1 };
}
