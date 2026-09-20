import { getRouteApi, useRouter, useRouterState } from "@tanstack/react-router";
import { findPreStock, setPreStockCatalog } from "@/lib/prestocks";
import type { PreStock } from "@/lib/types";

const rootRoute = getRouteApi("__root__");

export function useCatalog(): {
  stocks: PreStock[];
  stocksError: string | null;
  pending: boolean;
  retry: () => void;
  getBySymbol: (id: string) => PreStock | undefined;
} {
  const data = rootRoute.useLoaderData();
  setPreStockCatalog(data.stocks);
  const router = useRouter();
  const pending = useRouterState({
    select: (state) => state.status === "pending" && data.stocks.length === 0,
  });
  return {
    stocks: data.stocks,
    stocksError: data.stocksError,
    pending,
    retry: () => {
      void router.invalidate();
    },
    getBySymbol: (id: string) => findPreStock(data.stocks, id),
  };
}