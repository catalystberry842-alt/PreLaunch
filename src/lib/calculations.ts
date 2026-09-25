import { round1, round2 } from "./format.ts";

export const AMOUNT_PRESETS = [100, 500, 1000, 5000, 10000] as const;
export const SCENARIO_PRESETS = [-20, -10, 0, 10, 20] as const;
/** Every simulation opens flat: no position moves until the user sets one. */
export const DEFAULT_SCENARIO_PERCENT = 0;
export const SCENARIO_MIN = -90;
export const SCENARIO_MAX = 200;

export type WeightedItem = {
  allocation: number;
  value: number | null;
};

export type AllocationStats = {
  count: number;
  total: number;
  remaining: number;
  largest: number | null;
  smallest: number | null;
  average: number | null;
  isComplete: boolean;
};

/** One position in a hypothetical scenario. All values are USD. */
export type PositionOutcome = {
  /** Share of the starting amount assigned to this position. */
  startingValue: number;
  /** Starting value after the hypothetical % move. */
  resultingValue: number;
  /** resultingValue − startingValue. */
  pnl: number;
};

export function clampScenario(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(SCENARIO_MAX, Math.max(SCENARIO_MIN, round1(value)));
}

export function parseScenarioInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/%/g, "").replace(/^\+/, "");
  if (trimmed === "" || trimmed === "-" || trimmed === ".") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return clampScenario(value);
}

export function normalizeAllocations(items: { allocation: number }[]) {
  const total = items.reduce((sum, item) => sum + item.allocation, 0);
  if (total <= 0) return items.map(() => 0);
  return items.map((item) => item.allocation / total);
}

export function calculateBasketValue(items: WeightedItem[]): number | null {
  if (items.length === 0) return null;
  const weights = normalizeAllocations(items);
  let sum = 0;
  let hasValue = false;
  items.forEach((item, index) => {
    if (item.value == null || !Number.isFinite(item.value)) return;
    hasValue = true;
    sum += weights[index] * item.value;
  });
  return hasValue ? round2(sum) : null;
}

export function calculateScenarioValue(amount: number, scenarioPercent: number) {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  return round2(safeAmount * (1 + clampScenario(scenarioPercent) / 100));
}

/**
 * Starting value = amount × (allocation ÷ totalAllocation); resulting value =
 * starting value × (1 + move ÷ 100). Allocations are normalized by
 * `totalAllocation`, so a book that does not sum to exactly 100 still splits
 * the full amount.
 */
export function calculatePositionOutcome(
  amount: number,
  allocation: number,
  scenarioPercent: number,
  totalAllocation = 100,
): PositionOutcome {
  const total = totalAllocation > 0 ? totalAllocation : 0;
  const weight = total > 0 && allocation > 0 ? allocation / total : 0;
  const startingValue = round2(
    Math.max(0, Number.isFinite(amount) ? amount : 0) * weight,
  );
  const resultingValue = calculateScenarioValue(startingValue, scenarioPercent);
  return {
    startingValue,
    resultingValue,
    pnl: round2(resultingValue - startingValue),
  };
}

export type ScenarioResult = {
  rows: PositionOutcome[];
  /** Sum of position starting values (equals the amount, up to cent rounding). */
  startingValue: number;
  /** Sum of position resulting values. */
  finalValue: number;
  /** finalValue − startingValue. */
  pnl: number;
  /** pnl ÷ startingValue × 100, rounded to one decimal. */
  returnPercent: number;
};

/**
 * Pure what-if engine shared by the basket and portfolio simulators. Each
 * position gets its own hypothetical % move. Hypothetical only: no prices,
 * history or forecasts are involved.
 */
export function calculateHoldingsScenario(
  amount: number,
  items: { allocation: number; scenarioPercent: number }[],
): ScenarioResult {
  const total = items.reduce(
    (sum, item) => sum + (item.allocation > 0 ? item.allocation : 0),
    0,
  );
  const rows = items.map((item) =>
    calculatePositionOutcome(
      amount,
      item.allocation,
      item.scenarioPercent,
      total > 0 ? total : 100,
    ),
  );
  const startingValue = round2(rows.reduce((sum, row) => sum + row.startingValue, 0));
  const finalValue = round2(rows.reduce((sum, row) => sum + row.resultingValue, 0));
  const pnl = round2(finalValue - startingValue);
  const returnPercent = startingValue > 0 ? round1((pnl / startingValue) * 100) : 0;
  return { rows, startingValue, finalValue, pnl, returnPercent };
}

export function calculateAllocationStats(
  items: { allocation: number }[],
): AllocationStats {
  const count = items.length;
  const total = round1(items.reduce((sum, item) => sum + item.allocation, 0));
  const remaining = round1(100 - total);
  if (count === 0) {
    return {
      count: 0,
      total,
      remaining: 100,
      largest: null,
      smallest: null,
      average: null,
      isComplete: false,
    };
  }
  const allocations = items.map((item) => item.allocation);
  return {
    count,
    total,
    remaining,
    largest: round1(Math.max(...allocations)),
    smallest: round1(Math.min(...allocations)),
    average: round1(total / count),
    isComplete: Math.abs(total - 100) < 0.05,
  };
}
