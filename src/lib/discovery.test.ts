import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MOCK_BASKETS } from "../data/mock-baskets.ts";
import {
  DISCOVER_THEMES,
  FEATURED_BASKET_IDS,
  constituentSearchExtra,
  filterBaskets,
  getFeaturedBaskets,
  getNewestBaskets,
  getTrendingBaskets,
  matchesConstituentCount,
  searchBaskets,
} from "./discovery.ts";
import type { Basket } from "./types.ts";

function withMetrics(
  basket: Basket,
  views: number,
  saves: number,
  createdAt = basket.createdAt,
): Basket {
  return { ...basket, views, saves, createdAt };
}

describe("getFeaturedBaskets", () => {
  it("returns the curated local featured set in configured order", () => {
    const featured = getFeaturedBaskets(MOCK_BASKETS, 3);
    assert.deepEqual(
      featured.map((item) => item.id),
      [...FEATURED_BASKET_IDS],
    );
  });

  it("does not treat newest or high-engagement books as featured", () => {
    const featuredIds = new Set(getFeaturedBaskets(MOCK_BASKETS).map((item) => item.id));
    assert.equal(featuredIds.has("frontier-stack"), false);
    assert.equal(featuredIds.has("defense-autonomy"), false);
  });
});

describe("getTrendingBaskets", () => {
  it("ranks by views and saves, not launch date", () => {
    const oldHot = withMetrics(
      MOCK_BASKETS[0],
      400,
      40,
      "2026-01-01T00:00:00.000Z",
    );
    const newQuiet = withMetrics(
      MOCK_BASKETS[8],
      2,
      0,
      "2026-09-18T00:00:00.000Z",
    );
    const trending = getTrendingBaskets([newQuiet, oldHot], 2);
    assert.equal(trending[0].id, oldHot.id);
    assert.equal(trending[1].id, newQuiet.id);
  });
});

describe("getNewestBaskets", () => {
  it("sorts by createdAt descending", () => {
    const newest = getNewestBaskets(MOCK_BASKETS, 3);
    assert.equal(newest[0].id, "frontier-stack");
    const dates = newest.map((item) => Date.parse(item.createdAt));
    assert.ok(dates[0] >= dates[1] && dates[1] >= dates[2]);
  });
});

describe("searchBaskets", () => {
  it("matches name, thesis, creator, category, and constituent ids", () => {
    const byName = searchBaskets(MOCK_BASKETS, "Frontier Stack");
    assert.ok(byName.some((item) => item.id === "frontier-stack"));

    const byThesis = searchBaskets(MOCK_BASKETS, "event markets");
    assert.ok(byThesis.some((item) => item.id === "next-gen-fintech"));

    const byCreator = searchBaskets(MOCK_BASKETS, "mira.chen");
    assert.ok(byCreator.some((item) => item.id === "ai-infrastructure"));

    const byCategory = searchBaskets(MOCK_BASKETS, "Robotics");
    assert.ok(byCategory.some((item) => item.id === "robotics-revolution"));

    const bySymbol = searchBaskets(MOCK_BASKETS, "openai");
    const ids = bySymbol.map((item) => item.id);
    assert.ok(ids.includes("ai-infrastructure"));
    assert.ok(ids.includes("frontier-stack"));
    assert.ok(ids.includes("ai-application-layer"));
  });

  it("matches live constituent labels supplied as extra text", () => {
    const hits = searchBaskets(MOCK_BASKETS, "humanoid lab", (basket) =>
      constituentSearchExtra(basket, (id) =>
        id === "FIGUREAI" ? { name: "Figure AI", officialName: "humanoid lab" } : undefined,
      ),
    );
    assert.ok(hits.some((item) => item.id === "robotics-revolution"));
    assert.ok(!hits.some((item) => item.id === "next-gen-fintech"));
  });
});

describe("filterBaskets", () => {
  it("filters by PreLaunch category", () => {
    const defense = filterBaskets(MOCK_BASKETS, { category: "Defense" });
    assert.ok(defense.length >= 1);
    assert.ok(defense.every((item) => item.category === "Defense"));
  });

  it("filters by constituent count", () => {
    const two = filterBaskets(MOCK_BASKETS, { names: "2" });
    assert.ok(two.every((item) => item.constituents.length === 2));
    const fourPlus = filterBaskets(MOCK_BASKETS, { names: "4plus" });
    assert.ok(fourPlus.some((item) => item.id === "frontier-stack"));
    assert.ok(fourPlus.every((item) => item.constituents.length >= 4));
  });

  it("sorts newest, most viewed, and most saved", () => {
    const decorated = MOCK_BASKETS.map((basket, index) =>
      withMetrics(basket, index * 10, 20 - index),
    );
    const newest = filterBaskets(decorated, { sort: "newest" });
    assert.equal(newest[0].id, "frontier-stack");

    const viewed = filterBaskets(decorated, { sort: "views" });
    assert.equal(viewed[0].views, Math.max(...decorated.map((item) => item.views)));

    const saved = filterBaskets(decorated, { sort: "saves" });
    assert.equal(saved[0].saves, Math.max(...decorated.map((item) => item.saves)));
  });
});

describe("theme explorer", () => {
  it("lists the eight PreLaunch themes without Other", () => {
    assert.deepEqual([...DISCOVER_THEMES], [
      "AI",
      "Defense",
      "Robotics",
      "Fintech",
      "Space",
      "Infrastructure",
      "Consumer",
      "Private Markets",
    ]);
    assert.ok(matchesConstituentCount(5, "4plus"));
    assert.equal(matchesConstituentCount(3, "2"), false);
  });
});
