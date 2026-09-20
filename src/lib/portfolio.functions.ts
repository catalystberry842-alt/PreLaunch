import { createServerFn } from "@tanstack/react-start";
import type { PortfolioResponse } from "@/types/portfolio";

export const getPortfolioFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!data || typeof data !== "object") {
      return { wallet: "", fresh: false };
    }
    const record = data as { wallet?: unknown; fresh?: unknown };
    return {
      wallet: typeof record.wallet === "string" ? record.wallet : "",
      fresh: record.fresh === true,
    };
  })
  .handler(async ({ data }): Promise<PortfolioResponse> => {
    const { loadPortfolio } = await import("@/lib/portfolio-load.server");
    return loadPortfolio(data.wallet, { fresh: data.fresh });
  });
