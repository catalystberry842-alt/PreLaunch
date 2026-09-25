import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateAllocationStats,
  calculateBasketValue,
  calculateHoldingsScenario,
  calculatePositionOutcome,
  calculateScenarioValue,
  clampScenario,
  DEFAULT_SCENARIO_PERCENT,
  parseScenarioInput,
} from "./calculations.ts";

describe("calculateBasketValue", () => {
  it("weights two constituents by normalized allocation", () => {
    const value = calculateBasketValue([
      { allocation: 50, value: 100 },
      { allocation: 50, value: 200 },
    ]);
    assert.equal(value, 150);
  });

  it("normalizes allocations that do not already sum to 100", () => {
    const value = calculateBasketValue([
      { allocation: 2, value: 10 },
      { allocation: 2, value: 30 },
    ]);
    assert.equal(value, 20);
  });

  it("weights five or more constituents", () => {
    const value = calculateBasketValue([
      { allocation: 25, value: 100 },
      { allocation: 20, value: 100 },
      { allocation: 20, value: 100 },
      { allocation: 20, value: 100 },
      { allocation: 15, value: 200 },
    ]);
    assert.equal(value, 115);
  });

  it("skips missing API values without inventing a substitute", () => {
    const value = calculateBasketValue([
      { allocation: 40, value: 100 },
      { allocation: 60, value: null },
    ]);
    assert.equal(value, 40);
  });

  it("returns null when every constituent is unavailable", () => {
    assert.equal(
      calculateBasketValue([
        { allocation: 50, value: null },
        { allocation: 50, value: null },
      ]),
      null,
    );
  });
});

describe("calculateScenarioValue", () => {
  it("returns the starting amount at 0%", () => {
    assert.equal(calculateScenarioValue(1000, 0), 1000);
    assert.equal(calculateScenarioValue(100, 0), 100);
  });

  it("applies negative and positive scenarios", () => {
    assert.equal(calculateScenarioValue(1000, -20), 800);
    assert.equal(calculateScenarioValue(1000, 20), 1200);
  });

  it("applies a custom +35% scenario", () => {
    assert.equal(calculateScenarioValue(1000, 35), 1350);
  });
});

describe("calculatePositionOutcome", () => {
  it("matches the +20% contribution example", () => {
    const openai = calculatePositionOutcome(1000, 30, 20);
    assert.equal(openai.startingValue, 300);
    assert.equal(openai.resultingValue, 360);
    assert.equal(openai.pnl, 60);

    const anthropic = calculatePositionOutcome(1000, 25, 20);
    assert.equal(anthropic.pnl, 50);
  });

  it("uses normalized weights when the book is not 100%", () => {
    const outcome = calculatePositionOutcome(1000, 40, 10, 80);
    assert.equal(outcome.startingValue, 500);
    assert.equal(outcome.pnl, 50);
  });

  it("never assigns starting value to a negative allocation", () => {
    const outcome = calculatePositionOutcome(1000, -10, 50);
    assert.equal(outcome.startingValue, 0);
    assert.equal(outcome.pnl, 0);
  });
});

describe("calculateHoldingsScenario", () => {
  it("defaults to a flat 0% scenario", () => {
    assert.equal(DEFAULT_SCENARIO_PERCENT, 0);
    const result = calculateHoldingsScenario(10000, [
      { allocation: 60, scenarioPercent: DEFAULT_SCENARIO_PERCENT },
      { allocation: 40, scenarioPercent: DEFAULT_SCENARIO_PERCENT },
    ]);
    assert.equal(result.startingValue, 10000);
    assert.equal(result.finalValue, 10000);
    assert.equal(result.pnl, 0);
    assert.equal(result.returnPercent, 0);
  });

  it("$10,000 at 30% +25%, 30% -10%, 20% +15%, 20% +40% ends at $11,550 (+$1,550, +15.5%)", () => {
    const result = calculateHoldingsScenario(10000, [
      { allocation: 30, scenarioPercent: 25 },
      { allocation: 30, scenarioPercent: -10 },
      { allocation: 20, scenarioPercent: 15 },
      { allocation: 20, scenarioPercent: 40 },
    ]);
    assert.deepEqual(
      result.rows.map((row) => row.startingValue),
      [3000, 3000, 2000, 2000],
    );
    assert.deepEqual(
      result.rows.map((row) => row.resultingValue),
      [3750, 2700, 2300, 2800],
    );
    assert.deepEqual(
      result.rows.map((row) => row.pnl),
      [750, -300, 300, 800],
    );
    assert.equal(result.startingValue, 10000);
    assert.equal(result.finalValue, 11550);
    assert.equal(result.pnl, 1550);
    assert.equal(result.returnPercent, 15.5);
  });

  it("returns zeros for an empty or zero-amount book", () => {
    const empty = calculateHoldingsScenario(10000, []);
    assert.equal(empty.finalValue, 0);
    assert.equal(empty.returnPercent, 0);
    const zero = calculateHoldingsScenario(0, [{ allocation: 100, scenarioPercent: 50 }]);
    assert.equal(zero.finalValue, 0);
    assert.equal(zero.returnPercent, 0);
  });
});

describe("calculateAllocationStats", () => {
  it("reports a complete 100% book", () => {
    const stats = calculateAllocationStats([
      { allocation: 55 },
      { allocation: 45 },
    ]);
    assert.equal(stats.count, 2);
    assert.equal(stats.total, 100);
    assert.equal(stats.remaining, 0);
    assert.equal(stats.largest, 55);
    assert.equal(stats.smallest, 45);
    assert.equal(stats.average, 50);
    assert.equal(stats.isComplete, true);
  });

  it("shows remaining when allocation is under 100%", () => {
    const stats = calculateAllocationStats([
      { allocation: 50 },
      { allocation: 42 },
    ]);
    assert.equal(stats.total, 92);
    assert.equal(stats.remaining, 8);
    assert.equal(stats.isComplete, false);
  });
});

describe("scenario input", () => {
  it("parses signed percentages and clamps extremes", () => {
    assert.equal(parseScenarioInput("+35%"), 35);
    assert.equal(parseScenarioInput("-12"), -12);
    assert.equal(clampScenario(500), 200);
    assert.equal(clampScenario(-200), -90);
    assert.equal(parseScenarioInput(""), null);
  });
});
