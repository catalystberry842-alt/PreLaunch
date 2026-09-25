import type { PortfolioSnapshot } from "@/types/portfolio";

const KEY = "prelaunch.portfolio.snapshot.v2";

export function cachePortfolioSnapshot(snapshot: PortfolioSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Private mode can block sessionStorage.
  }
}

export function readCachedPortfolio(wallet: string): PortfolioSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortfolioSnapshot;
    if (!parsed || parsed.wallet !== wallet) return null;
    if (!Array.isArray(parsed.positions)) return null;
    if (typeof parsed.unpricedCount !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}
