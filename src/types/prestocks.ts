export type { PreStock, PreStocksApiItem } from "@/lib/types";

/** Trim only. Solana addresses are case-sensitive — never lowercased. */
export function normalizeContractAddress(value: string) {
  return value.trim();
}
