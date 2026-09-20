import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateAllocationStats,
  calculateBasketValue,
  calculateConstituentImpact,
  calculateScenarioValue,
  clampScenario,
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

describe("calculateConstituentImpact", () => {
  it("matches the +20% contribution example", () => {
    const openai = calculateConstituentImpact(1000, 30, 20);
    assert.equal(openai.sleeve, 300);
    assert.equal(openai.scenarioValue, 360);
    assert.equal(openai.contribution, 60);

    const anthropic = calculateConstituentImpact(1000, 25, 20);
    assert.equal(anthropic.contribution, 50);
  });

  it("uses normalized weights when the book is not 100%", () => {
    const impact = calculateConstituentImpact(1000, 40, 10, 80);
    assert.equal(impact.sleeve, 500);
    assert.equal(impact.contribution, 50);
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
