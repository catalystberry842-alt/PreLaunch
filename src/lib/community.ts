import { useEffect, useState } from "react";
import { getSavedBasketById, saveBasket } from "@/lib/baskets";
import { rankScore } from "@/lib/ranking";
import type { Basket, BasketSort } from "@/lib/types";

export { rankScore } from "@/lib/ranking";

const METRICS_KEY = "prelaunch.metrics.v2";
const SAVED_KEY = "prelaunch.saved.v1";
const SESSION_KEY = "prelaunch.session-views.v1";
export const COMMUNITY_EVENT = "prelaunch-community";

type MetricsStore = {
  views: Record<string, number>;
};

function canUseStorage() {
  return typeof window !== "undefined" && window.localStorage !== undefined;
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMMUNITY_EVENT));
}

function readMetrics(): MetricsStore {
  const parsed = readJson<MetricsStore>(METRICS_KEY, { views: {} });
  return { views: parsed.views ?? {} };
}

function readSavedIds(): string[] {
  const parsed = readJson<string[]>(SAVED_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function readSessionViews(): string[] {
  if (typeof window === "undefined" || !window.sessionStorage) return [];
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSessionViews(ids: string[]) {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(ids));
}

export function isSaved(id: string) {
  return readSavedIds().includes(id);
}

export function savedIds() {
  return readSavedIds();
}

export function viewsOf(basket: Pick<Basket, "id" | "source" | "views">) {
  const extras = readMetrics().views[basket.id];
  if (typeof extras === "number" && Number.isFinite(extras)) return extras;
  return basket.views ?? 0;
}

export function savesOf(basket: Pick<Basket, "id" | "source" | "saves">) {
  const mine = isSaved(basket.id) ? 1 : 0;
  return Math.max(basket.saves ?? 0, mine);
}

export function decorateBasket<T extends Basket>(basket: T): T {
  return {
    ...basket,
    updatedAt: basket.updatedAt || basket.createdAt,
    views: viewsOf(basket),
    saves: savesOf(basket),
  };
}

export function recordView(basket: Basket) {
  if (!canUseStorage()) return;
  const session = readSessionViews();
  if (session.includes(basket.id)) return;
  writeSessionViews([...session, basket.id]);

  const metrics = readMetrics();
  metrics.views[basket.id] = (readMetrics().views[basket.id] ?? basket.views ?? 0) + 1;
  writeJson(METRICS_KEY, metrics);

  if (basket.source === "local") {
    const current = getSavedBasketById(basket.id);
    if (current) {
      try {
        saveBasket({
          ...current,
          views: metrics.views[basket.id],
          updatedAt: current.updatedAt || current.createdAt,
        });
      } catch {
        // Metrics still persist in the community store.
      }
    }
  }
  emit();
}

export function rememberPublishedBasket(basket: Basket) {
  if (!canUseStorage()) return;
  const ids = readSavedIds();
  if (!ids.includes(basket.id)) {
    writeJson(SAVED_KEY, [basket.id, ...ids]);
  }
  emit();
}

export function toggleSave(basket: Basket) {
  if (!canUseStorage()) {
    return { saved: false, error: "This browser cannot save baskets." };
  }
  const ids = readSavedIds();
  const saved = ids.includes(basket.id);
  const next = saved ? ids.filter((id) => id !== basket.id) : [...ids, basket.id];
  if (!writeJson(SAVED_KEY, next)) {
    return { saved, error: "Unable to update saved baskets." };
  }

  if (basket.source === "local") {
    const current = getSavedBasketById(basket.id);
    if (current) {
      try {
        saveBasket({
          ...current,
          saves: saved ? 0 : 1,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Saved list already updated.
      }
    }
  }
  emit();
  return { saved: !saved };
}

export function sortBaskets(items: Basket[], sort: BasketSort) {
  const copy = items.map(decorateBasket);
  copy.sort((a, b) => {
    if (sort === "newest") {
      return Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.name.localeCompare(b.name);
    }
    if (sort === "views") {
      return viewsOf(b) - viewsOf(a) || a.name.localeCompare(b.name);
    }
    if (sort === "saves") {
      return savesOf(b) - savesOf(a) || a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
  return copy;
}

export function trendingBaskets(items: Basket[], limit = 4) {
  return [...items]
    .map(decorateBasket)
    .sort((a, b) => {
      const delta =
        rankScore({
          views: viewsOf(b),
          saves: savesOf(b),
          constituents: b.constituents.length,
          createdAt: b.createdAt,
        }) -
        rankScore({
          views: viewsOf(a),
          saves: savesOf(a),
          constituents: a.constituents.length,
          createdAt: a.createdAt,
        });
      return delta || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function newestBaskets(items: Basket[], limit = 4) {
  return sortBaskets(items, "newest").slice(0, limit);
}

export function relatedBaskets(items: Basket[], basket: Basket, limit = 3) {
  const same = items.filter(
    (item) => item.id !== basket.id && item.category === basket.category,
  );
  const pool = same.length >= limit ? same : items.filter((item) => item.id !== basket.id);
  return trendingBaskets(pool, limit);
}

export function useCommunity() {
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const on = () => setTick((n) => n + 1);
    window.addEventListener(COMMUNITY_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(COMMUNITY_EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return { ready, tick };
}
