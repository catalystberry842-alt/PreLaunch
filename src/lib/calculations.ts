export const AMOUNT_PRESETS = [100, 500, 1000, 5000, 10000] as const;
export const SCENARIO_PRESETS = [-20, -10, 0, 10, 20] as const;
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

export type ConstituentImpact = {
  sleeve: number;
  scenarioValue: number;
  contribution: number;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

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

export function calculateConstituentImpact(
  amount: number,
  allocation: number,
  scenarioPercent: number,
  totalAllocation = 100,
): ConstituentImpact {
  const total = totalAllocation > 0 ? totalAllocation : 0;
  const weight = total > 0 ? allocation / total : 0;
  const sleeve = round2(Math.max(0, Number.isFinite(amount) ? amount : 0) * weight);
  const scenarioValue = calculateScenarioValue(sleeve, scenarioPercent);
  return {
    sleeve,
    scenarioValue,
    contribution: round2(scenarioValue - sleeve),
  };
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
