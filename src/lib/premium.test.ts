import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { basketPremium, impliedVsMark, tokenVsMark } from "./premium.ts";

describe("tokenVsMark", () => {
  it("is (token − mark) ÷ mark in percent", () => {
    const value = tokenVsMark({ tokenPrice: 110, markPrice: 100 });
    assert.ok(value != null);
    assert.equal(Math.round(value * 1000) / 1000, 10);
  });
  it("is null when either price is missing (normalized to 0)", () => {
    assert.equal(tokenVsMark({ tokenPrice: 0, markPrice: 100 }), null);
    assert.equal(tokenVsMark({ tokenPrice: 100, markPrice: 0 }), null);
  });
});

describe("impliedVsMark", () => {
  it("compares implied and mark valuation", () => {
    assert.equal(impliedVsMark({ impliedValuation: 90, markValuation: 100 }), -10);
    assert.equal(impliedVsMark({ impliedValuation: 0, markValuation: 100 }), null);
  });
});

describe("basketPremium", () => {
  it("weights each constituent's premium by allocation", () => {
    const result = basketPremium([
      { allocation: 40, stock: { tokenPrice: 127.8, markPrice: 100 } }, // +27.8%
      { allocation: 35, stock: { tokenPrice: 102.4, markPrice: 100 } }, // +2.4%
      { allocation: 25, stock: { tokenPrice: 97.3, markPrice: 100 } }, // −2.7%
    ]);
    // 0.40×27.8 + 0.35×2.4 + 0.25×(−2.7) = 11.285
    assert.equal(result.value, 11.3);
    assert.equal(result.covered, 3);
    assert.equal(result.total, 3);
  });
  it("re-normalizes over priced constituents and reports coverage", () => {
    const result = basketPremium([
      { allocation: 50, stock: { tokenPrice: 120, markPrice: 100 } },
      { allocation: 50, stock: { tokenPrice: 120, markPrice: 0 } },
      { allocation: 10, stock: null },
    ]);
    assert.equal(result.value, 20);
    assert.equal(result.covered, 1);
    assert.equal(result.total, 3);
  });
  it("is null when no constituent has both prices", () => {
    assert.equal(basketPremium([{ allocation: 100, stock: null }]).value, null);
  });
});
