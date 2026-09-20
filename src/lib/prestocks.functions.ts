import { createServerFn } from "@tanstack/react-start";
import type { PreStock } from "@/lib/types";

export const getPreStocksFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<PreStock[]> => {
    const { fetchPreStocks } = await import("./prestocks-api");
    return fetchPreStocks();
  },
);
