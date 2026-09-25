import { round1 } from "./format.ts";
import { canonicalizePreStockId } from "./prestock-meta.ts";

/** Published baskets must contain at least this many PreStocks. */
export const MIN_BASKET_CONSTITUENTS = 2;

/**
 * Allowed distance from exactly 100%. Covers floating-point noise such as
 * 33.3 + 33.3 + 33.4 and one-decimal UI rounding; anything further off is a
 * real under- or over-allocation.
 */
export const ALLOCATION_TOLERANCE = 0.05;

export type AllocationEntry = {
  preStockId: string;
  allocation: number | null | undefined;
};

/**
 * Validate a basket's allocation book. Pure: no storage or catalog access.
 * Returns human-readable issues; an empty array means the book is valid.
 *
 * Rules: at least {@link MIN_BASKET_CONSTITUENTS} PreStocks, no empty or
 * duplicate ids (after alias canonicalization), every allocation a finite
 * number above 0, and the total within {@link ALLOCATION_TOLERANCE} of 100%.
 */
export function validateAllocations(entries: AllocationEntry[]): string[] {
  const issues: string[] = [];

  if (entries.length < MIN_BASKET_CONSTITUENTS) {
    issues.push(`Add at least ${MIN_BASKET_CONSTITUENTS} PreStocks`);
    return issues;
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let emptyId = false;
  for (const entry of entries) {
    const id = canonicalizePreStockId(entry.preStockId ?? "");
    if (!id) {
      emptyId = true;
      continue;
    }
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  if (emptyId) issues.push("Every allocation must reference a PreStock");
  if (duplicates.size > 0) {
    issues.push(`Each PreStock can appear only once: ${[...duplicates].join(", ")}`);
  }

  const values = entries.map((entry) => entry.allocation);
  if (values.some((value) => value == null || !Number.isFinite(value))) {
    issues.push("Give every PreStock an allocation");
    return issues;
  }
  const numbers = values as number[];
  if (numbers.some((value) => value < 0)) {
    issues.push("Allocations cannot be negative");
    return issues;
  }
  if (numbers.some((value) => value === 0)) {
    issues.push("Every PreStock needs an allocation above 0%");
  }

  const rawTotal = numbers.reduce((sum, value) => sum + value, 0);
  const total = round1(rawTotal);
  if (rawTotal > 100 + ALLOCATION_TOLERANCE) {
    issues.push(`Allocation total: ${total}%. ${round1(rawTotal - 100)}% over 100%`);
  } else if (rawTotal < 100 - ALLOCATION_TOLERANCE) {
    issues.push(`Allocation total: ${total}%. ${round1(100 - rawTotal)}% remaining`);
  }

  return issues;
}

/** Allocation entries for the selected ids only; stale keys are ignored. */
export function draftAllocationEntries(
  selectedIds: string[],
  allocations: Record<string, number>,
): AllocationEntry[] {
  return selectedIds.map((id) => ({ preStockId: id, allocation: allocations[id] }));
}
