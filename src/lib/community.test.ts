import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOCK_BASKETS } from "../data/mock-baskets.ts";
import { matchesBasketText, rankScore } from "./ranking.ts";
import { CATEGORIES } from "./types.ts";

describe("community ranking", () => {
  it("scores higher views and more recent launches above older quiet books", () => {
    const hot = rankScore({
      views: 200,
      saves: 20,
      constituents: 3,
      createdAt: "2026-09-18T00:00:00.000Z",
      now: Date.parse("2026-09-19T00:00:00.000Z"),
    });
    const quiet = rankScore({
      views: 10,
      saves: 1,
      constituents: 2,
      createdAt: "2026-06-01T00:00:00.000Z",
      now: Date.parse("2026-09-19T00:00:00.000Z"),
    });
    assert.ok(hot > quiet);
  });
});

describe("basket search", () => {
  it("finds AI baskets by category and constituent id", () => {
    const hits = MOCK_BASKETS.filter((basket) => matchesBasketText(basket, "AI"));
    const ids = hits.map((item) => item.id);
    assert.ok(ids.includes("ai-infrastructure"));
    assert.ok(ids.includes("frontier-stack"));
    assert.ok(ids.includes("robotics-revolution"));
  });

  it("finds baskets by creator and thesis", () => {
    const byCreator = MOCK_BASKETS.filter((basket) =>
      matchesBasketText(basket, "mira.chen"),
    );
    assert.ok(byCreator.some((item) => item.id === "ai-infrastructure"));
    const byThesis = MOCK_BASKETS.filter((basket) =>
      matchesBasketText(basket, "event markets"),
    );
    assert.ok(byThesis.some((item) => item.id === "next-gen-fintech"));
  });
});

describe("categories", () => {
  it("includes the PreLaunch category set", () => {
    assert.deepEqual([...CATEGORIES], [
      "AI",
      "Robotics",
      "Defense",
      "Fintech",
      "Space",
      "Infrastructure",
      "Consumer",
      "Private Markets",
      "Other",
    ]);
  });
});
