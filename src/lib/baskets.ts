import { MOCK_BASKETS } from "@/data/mock-baskets";
import {
  calculateTotalAllocation,
  equalAllocations,
  isValidAllocation,
} from "@/lib/format";
import { canonicalizePreStockId } from "@/lib/prestock-meta";
import { prestocks } from "@/lib/prestocks";
import { matchesBasketText } from "@/lib/ranking";
import type { Basket, BasketDraft, FilterCategory } from "@/lib/types";

const STORAGE_KEY = "prelaunch.baskets.v1";
const DRAFT_KEY = "prelaunch.draft.v1";

export const DEFAULT_CREATOR = "Anonymous Creator";

function canUseStorage() {
  return typeof window !== "undefined" && window.localStorage !== undefined;
}

function normalizeBasket(basket: Basket): Basket {
  return {
    ...basket,
    source: basket.source ?? "local",
    updatedAt: basket.updatedAt || basket.createdAt,
    views: basket.views ?? 0,
    saves: basket.saves ?? 0,
  };
}

export function getSavedBaskets(): Basket[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Basket[];
    return Array.isArray(parsed)
      ? parsed.map((basket) => normalizeBasket({ ...basket, source: "local" }))
      : [];
  } catch {
    return [];
  }
}

export function saveBasket(basket: Basket) {
  if (!canUseStorage()) {
    throw new Error("This browser cannot save baskets.");
  }
  try {
    const next = [
      normalizeBasket(basket),
      ...getSavedBaskets().filter((item) => item.id !== basket.id),
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error("Unable to save this basket in the browser.");
  }
}

export function getSavedBasketById(id: string): Basket | undefined {
  return getSavedBaskets().find((basket) => basket.id === id);
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "basket"
  );
}

export function matchesBasketQuery(basket: Basket, query: string) {
  const extra = basket.constituents
    .map((item) => {
      const stock = prestocks.getById(item.preStockId);
      return [
        item.preStockId,
        stock?.name ?? "",
        stock?.symbol ?? "",
        stock?.officialName ?? "",
        stock?.category ?? "",
        stock?.description ?? "",
      ].join(" ");
    })
    .join(" ");
  return matchesBasketText(basket, query, extra);
}

function normalizeDraft(value: Partial<BasketDraft> | null): BasketDraft | null {
  if (!value) return null;
  return {
    ...emptyDraft(),
    ...value,
    creator: value.creator?.trim() || DEFAULT_CREATOR,
    selectedIds: Array.isArray(value.selectedIds)
      ? value.selectedIds.map(canonicalizePreStockId)
      : [],
    allocations: Object.fromEntries(
      Object.entries(value.allocations ?? {}).map(([id, amount]) => [
        canonicalizePreStockId(id),
        amount,
      ]),
    ),
    category: value.category ?? "AI",
  };
}

export const baskets = {
  getCatalog(): Basket[] {
    return MOCK_BASKETS;
  },
  getUserBaskets(): Basket[] {
    return getSavedBaskets();
  },
  getAll(): Basket[] {
    const local = getSavedBaskets();
    const localIds = new Set(local.map((basket) => basket.id));
    return [
      ...local,
      ...MOCK_BASKETS.filter((basket) => !localIds.has(basket.id)),
    ];
  },
  getById(id: string): Basket | undefined {
    return (
      getSavedBasketById(id) ?? this.getAll().find((basket) => basket.id === id)
    );
  },
  getFeatured(): Basket[] {
    return this.getAll().filter((basket) => basket.featured);
  },
  search(query: string, category: FilterCategory = "All"): Basket[] {
    return this.getAll().filter((basket) => {
      if (category !== "All" && basket.category !== category) return false;
      return matchesBasketQuery(basket, query);
    });
  },
  validateDraft(draft: BasketDraft): string[] {
    const errors: string[] = [];
    if (!draft.name.trim()) errors.push("Add a basket name");
    if (!draft.description.trim()) errors.push("Add a short description");
    if (!draft.category) errors.push("Choose a category");
    if (!draft.creator.trim()) errors.push("Add a creator");
    if (draft.selectedIds.length < 2) errors.push("Add at least 2 PreStocks");
    else {
      const missingAllocation = draft.selectedIds.some(
        (id) => draft.allocations[id] == null,
      );
      if (missingAllocation) {
        errors.push("Give every PreStock an allocation");
      }
      const total = calculateTotalAllocation(draft.allocations);
      if (total > 100) {
        errors.push(
          `Allocation total: ${total}%. ${Math.round((total - 100) * 10) / 10}% over 100%`,
        );
      } else if (!isValidAllocation(draft.allocations, draft.selectedIds)) {
        const remaining = Math.round((100 - total) * 10) / 10;
        errors.push(`Allocation total: ${total}%. ${remaining}% remaining`);
      }
    }
    if (!draft.thesis.trim()) errors.push("Add a thesis before launching");
    return errors;
  },
  publish(draft: BasketDraft) {
    const errors = this.validateDraft(draft);
    if (errors.length > 0) throw new Error(errors[0]);
    const constituents = draft.selectedIds.map((id) => ({
      preStockId: canonicalizePreStockId(id),
      allocation: draft.allocations[id] ?? 0,
    }));
    const now = new Date().toISOString();
    const basket: Basket = {
      id: `${slugify(draft.name)}-${Date.now().toString(36)}`,
      name: draft.name.trim(),
      description: draft.description.trim(),
      category: draft.category,
      creator: draft.creator.trim() || DEFAULT_CREATOR,
      thesis: draft.thesis.trim(),
      constituents,
      createdAt: now,
      updatedAt: now,
      views: 0,
      saves: 0,
      source: "local",
    };
    saveBasket(basket);
    return { ok: true as const, basket };
  },
  readDraft(): BasketDraft | null {
    if (!canUseStorage()) return null;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      return raw
        ? normalizeDraft(JSON.parse(raw) as Partial<BasketDraft>)
        : null;
    } catch {
      return null;
    }
  },
  writeDraft(draft: BasketDraft) {
    if (!canUseStorage()) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Draft persistence is best-effort.
    }
  },
  clearDraft() {
    if (canUseStorage()) window.localStorage.removeItem(DRAFT_KEY);
  },
};

export function emptyDraft(): BasketDraft {
  return {
    name: "",
    description: "",
    category: "AI",
    creator: DEFAULT_CREATOR,
    selectedIds: [],
    allocations: equalAllocations([]),
    thesis: "",
  };
}
