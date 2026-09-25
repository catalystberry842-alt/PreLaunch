import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOCATION_TOLERANCE,
  draftAllocationEntries,
  validateAllocations,
} from "./basket-validation.ts";
import { equalAllocations } from "./format.ts";

const entry = (preStockId: string, allocation: number | null | undefined) => ({
  preStockId,
  allocation,
});

describe("validateAllocations", () => {
  it("accepts a book that sums to exactly 100%", () => {
    assert.deepEqual(validateAllocations([entry("OPENAI", 60), entry("ANTHROPIC", 40)]), []);
  });

  it("tolerates floating-point noise around 100%", () => {
    assert.deepEqual(
      validateAllocations([entry("OPENAI", 33.3), entry("ANTHROPIC", 33.3), entry("SPACEX", 33.4)]),
      [],
    );
    assert.deepEqual(
      validateAllocations([entry("OPENAI", 0.1 + 0.2), entry("ANTHROPIC", 99.7)]),
      [],
    );
  });

  it("rejects totals outside the tolerance", () => {
    const under = validateAllocations([entry("OPENAI", 50), entry("ANTHROPIC", 49.9)]);
    assert.deepEqual(under, ["Allocation total: 99.9%. 0.1% remaining"]);
    const over = validateAllocations([entry("OPENAI", 60), entry("ANTHROPIC", 45)]);
    assert.deepEqual(over, ["Allocation total: 105%. 5% over 100%"]);
    assert.ok(ALLOCATION_TOLERANCE < 0.1);
  });

  it("rejects empty and single-name books", () => {
    assert.deepEqual(validateAllocations([]), ["Add at least 2 PreStocks"]);
    assert.deepEqual(validateAllocations([entry("OPENAI", 100)]), ["Add at least 2 PreStocks"]);
  });

  it("rejects negative allocations", () => {
    const issues = validateAllocations([entry("OPENAI", 120), entry("ANTHROPIC", -20)]);
    assert.deepEqual(issues, ["Allocations cannot be negative"]);
  });

  it("rejects zero, missing and non-finite allocations", () => {
    assert.ok(
      validateAllocations([entry("OPENAI", 100), entry("ANTHROPIC", 0)]).includes(
        "Every PreStock needs an allocation above 0%",
      ),
    );
    assert.deepEqual(validateAllocations([entry("OPENAI", 100), entry("ANTHROPIC", undefined)]), [
      "Give every PreStock an allocation",
    ]);
    assert.deepEqual(validateAllocations([entry("OPENAI", 50), entry("ANTHROPIC", Number.NaN)]), [
      "Give every PreStock an allocation",
    ]);
  });

  it("rejects duplicate PreStocks, including aliases of the same id", () => {
    const issues = validateAllocations([entry("OPENAI", 50), entry("openai", 50)]);
    assert.deepEqual(issues, ["Each PreStock can appear only once: OPENAI"]);
  });

  it("rejects entries without a PreStock id", () => {
    const issues = validateAllocations([entry("OPENAI", 50), entry("  ", 50)]);
    assert.deepEqual(issues, ["Every allocation must reference a PreStock"]);
  });

  it("accepts every equal-weight split the create flow produces", () => {
    for (let count = 2; count <= 12; count += 1) {
      const ids = Array.from({ length: count }, (_, index) => `ID${index}`);
      const issues = validateAllocations(draftAllocationEntries(ids, equalAllocations(ids)));
      assert.deepEqual(issues, [], `equal split of ${count}`);
    }
  });
});

describe("draftAllocationEntries", () => {
  it("ignores stale allocations for ids that are no longer selected", () => {
    const entries = draftAllocationEntries(["OPENAI", "ANTHROPIC"], {
      OPENAI: 50,
      ANTHROPIC: 50,
      SPACEX: 40,
    });
    assert.deepEqual(entries, [entry("OPENAI", 50), entry("ANTHROPIC", 50)]);
    assert.deepEqual(validateAllocations(entries), []);
  });
});
