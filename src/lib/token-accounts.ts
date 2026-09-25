import { createHash } from "node:crypto";
import { decodeBase58, encodeBase58 } from "./solana-address.ts";

/**
 * Token-account helpers used to scope wallet history to PreStock token
 * accounts. Pure (Node `crypto` only); imported by server modules and tests.
 */

export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

const P = (1n << 255n) - 19n;

function mod(a: bigint) {
  const r = a % P;
  return r >= 0n ? r : r + P;
}

function pow(base: bigint, exp: bigint) {
  let result = 1n;
  let b = mod(base);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % P;
    b = (b * b) % P;
    e >>= 1n;
  }
  return result;
}

const D = mod(-121665n * pow(121666n, P - 2n));

/** True when 32 bytes decode to a point on the ed25519 curve. */
export function isOnCurve(bytes: Uint8Array): boolean {
  if (bytes.length !== 32) return false;
  let y = 0n;
  for (let i = 31; i >= 0; i -= 1) {
    y = (y << 8n) | BigInt(i === 31 ? bytes[i] & 0x7f : bytes[i]);
  }
  const sign = (bytes[31] & 0x80) !== 0;
  if (y >= P) return false;
  const y2 = (y * y) % P;
  const u = mod(y2 - 1n);
  const v = mod(D * y2 + 1n);
  const x2 = (u * pow(v, P - 2n)) % P;
  if (x2 === 0n) return !sign;
  return pow(x2, (P - 1n) / 2n) === 1n;
}

function pubkeyBytes(address: string) {
  const bytes = decodeBase58(address.trim());
  if (!bytes || bytes.length !== 32) throw new Error(`Invalid public key: ${address}`);
  return bytes;
}

/** Solana `findProgramAddress`: first off-curve hash, bump 255 → 0. */
export function findProgramAddress(seeds: Uint8Array[], programId: string): string {
  const program = pubkeyBytes(programId);
  const marker = new TextEncoder().encode("ProgramDerivedAddress");
  for (let bump = 255; bump >= 0; bump -= 1) {
    const hash = createHash("sha256");
    for (const seed of seeds) hash.update(seed);
    hash.update(Uint8Array.of(bump));
    hash.update(program);
    hash.update(marker);
    const candidate = new Uint8Array(hash.digest());
    if (!isOnCurve(candidate)) return encodeBase58(candidate);
  }
  throw new Error("No viable program address");
}

/** Associated token account for `owner` + `mint` under `tokenProgram`. */
export function associatedTokenAddress(
  owner: string,
  mint: string,
  tokenProgram = TOKEN_2022_PROGRAM,
): string {
  return findProgramAddress(
    [pubkeyBytes(owner), pubkeyBytes(tokenProgram), pubkeyBytes(mint)],
    ASSOCIATED_TOKEN_PROGRAM,
  );
}

export type PreStockTokenAccount = {
  /** Token account address. */
  address: string;
  mint: string;
  /** Currently open (returned by getTokenAccountsByOwner). */
  open: boolean;
};

/**
 * Accounts whose history is fetched: every open token account the wallet holds
 * for a catalog mint (including zero-balance ones), plus the derived
 * associated token account for each catalog mint so a closed ATA's history
 * (e.g. a fully exited position) is still read. Deduplicated by address.
 */
export function preStockHistoryAccounts(
  owner: string,
  openAccounts: { address: string; mint: string }[],
  catalogMints: string[],
): PreStockTokenAccount[] {
  const mints = new Set(catalogMints.map((m) => m.trim()).filter(Boolean));
  const byAddress = new Map<string, PreStockTokenAccount>();
  for (const account of openAccounts) {
    const address = account.address.trim();
    const mint = account.mint.trim();
    if (!address || !mints.has(mint) || byAddress.has(address)) continue;
    byAddress.set(address, { address, mint, open: true });
  }
  for (const mint of mints) {
    let ata: string;
    try {
      ata = associatedTokenAddress(owner, mint);
    } catch {
      continue;
    }
    if (!byAddress.has(ata)) byAddress.set(ata, { address: ata, mint, open: false });
  }
  return [...byAddress.values()];
}

/** Merge per-account transaction lists, dropping duplicate signatures. */
export function mergeBySignature(batches: unknown[][]): unknown[] {
  const seen = new Set<string>();
  const merged: unknown[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      const signature =
        item && typeof item === "object"
          ? (item as { signature?: unknown }).signature
          : null;
      if (typeof signature === "string" && signature) {
        if (seen.has(signature)) continue;
        seen.add(signature);
      }
      merged.push(item);
    }
  }
  return merged;
}

/**
 * Choose which signatures to parse under a total budget. Accounts with the
 * fewest signatures are taken whole first (they can yield a complete cost
 * basis). An account whose list was already cut off, or that no longer fits
 * the budget, contributes only its newest `recentOnly` signatures (for the
 * transaction list) and its mint is reported as truncated.
 */
export function selectSignatures(
  lists: { mint: string; signatures: string[]; truncated: boolean }[],
  budget: number,
  recentOnly: number,
): { signatures: string[]; truncatedMints: string[] } {
  const truncated = new Set<string>();
  const chosen: string[] = [];
  const seen = new Set<string>();
  let remaining = Math.max(0, budget);
  const take = (items: string[]) => {
    for (const signature of items) {
      if (seen.has(signature)) continue;
      seen.add(signature);
      chosen.push(signature);
      remaining -= 1;
    }
  };
  const order = lists
    .map((list, index) => ({ list, index }))
    .sort((a, b) => a.list.signatures.length - b.list.signatures.length || a.index - b.index);
  for (const { list } of order) {
    const fresh = list.signatures.filter((signature) => !seen.has(signature));
    if (!list.truncated && fresh.length <= remaining) {
      take(fresh);
      continue;
    }
    truncated.add(list.mint);
    take(fresh.slice(0, Math.min(recentOnly, remaining)));
  }
  return { signatures: chosen, truncatedMints: [...truncated] };
}
