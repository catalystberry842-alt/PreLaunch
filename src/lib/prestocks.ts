import { canonicalizePreStockId } from "@/lib/prestock-meta";
import type {
  Basket,
  BasketConstituent,
  BasketHolding,
  FilterCategory,
  PreStock,
  ResolvedConstituent,
} from "@/lib/types";

let catalog: PreStock[] = [];

export function setPreStockCatalog(stocks: PreStock[]) {
  catalog = stocks;
}

export function getPreStockCatalog() {
  return catalog;
}

function matchesQuery(stock: PreStock, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    stock.name.toLowerCase().includes(q) ||
    stock.officialName.toLowerCase().includes(q) ||
    stock.symbol.toLowerCase().includes(q) ||
    stock.description.toLowerCase().includes(q)
  );
}

export function findPreStock(stocks: PreStock[], id: string) {
  const canonical = canonicalizePreStockId(id);
  return stocks.find(
    (stock) =>
      stock.id === canonical ||
      stock.symbol === canonical ||
      stock.symbol.toLowerCase() === id.trim().toLowerCase(),
  );
}

export const prestocks = {
  getAll(): PreStock[] {
    return catalog;
  },
  getById(id: string): PreStock | undefined {
    return findPreStock(catalog, id);
  },
  search(query: string, category: FilterCategory = "All"): PreStock[] {
    return catalog.filter((stock) => {
      if (category !== "All" && stock.category !== category) return false;
      return matchesQuery(stock, query);
    });
  },
};

export function searchPreStocks(
  stocks: PreStock[],
  query: string,
  category: FilterCategory = "All",
) {
  return stocks.filter((stock) => {
    if (category !== "All" && stock.category !== category) return false;
    return matchesQuery(stock, query);
  });
}

export function resolveHoldings(
  constituents: BasketConstituent[],
  stocks: PreStock[] = catalog,
): BasketHolding[] {
  return constituents.map((item) => {
    const canonical = canonicalizePreStockId(item.preStockId);
    const stock =
      stocks.find(
        (entry) => entry.id === canonical || entry.symbol === canonical,
      ) ?? null;
    return {
      preStockId: stock?.id ?? canonical,
      allocation: item.allocation,
      stock,
    };
  });
}

export function resolveConstituents(
  constituents: BasketConstituent[],
  stocks: PreStock[] = catalog,
): ResolvedConstituent[] {
  return resolveHoldings(constituents, stocks).filter(
    (item): item is ResolvedConstituent => item.stock !== null,
  );
}

export function relatedBaskets(stockId: string, all: Basket[]) {
  const canonical = canonicalizePreStockId(stockId);
  return all.filter((basket) =>
    basket.constituents.some(
      (item) => canonicalizePreStockId(item.preStockId) === canonical,
    ),
  );
}
