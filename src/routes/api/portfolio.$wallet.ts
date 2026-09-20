import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/portfolio/$wallet")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { loadPortfolio } = await import("@/lib/portfolio-load.server");
        const wallet = decodeURIComponent(params.wallet ?? "");
        const result = await loadPortfolio(wallet);
        const headers = { "Cache-Control": "no-store" };

        if (result.ok) {
          const { snapshot } = result;
          return Response.json(
            {
              wallet: snapshot.wallet,
              positions: snapshot.positions.map((item) => ({
                mintAddress: item.contractAddress,
                symbol: item.symbol,
                name: item.name,
                quantity: item.quantity,
                currentPrice: item.tokenPrice,
                currentValue: item.value,
                allocationPercent: item.allocation,
                costBasis: item.costBasis,
                unrealizedPnl: item.unrealizedPnl,
                unrealizedPnlPercent: item.unrealizedPnlPercent,
              })),
              totalValue: snapshot.totalValue,
              totalCostBasis: snapshot.totalCostBasis,
              unrealizedPnl: snapshot.unrealizedPnl,
              realizedPnl: snapshot.realizedPnl,
              costBasisMethod: snapshot.costBasisMethod,
              transactions: snapshot.transactions.map((item) => ({
                walletAddress: item.walletAddress,
                date: item.timestamp,
                signature: item.signature,
                mintAddress: item.mint,
                symbol: item.symbol,
                type: item.typeLabel,
                quantity: item.quantity,
                price: item.unitPriceUsd,
                value: item.valueUsd,
              })),
              lastUpdated: snapshot.fetchedAt,
            },
            { status: 200, headers },
          );
        }

        const status =
          result.code === "invalid_wallet"
            ? 400
            : result.error === "HELIUS_CONFIG_MISSING" ||
                result.error === "HELIUS_AUTH_ERROR"
              ? 503
              : result.code === "catalog"
                ? 502
                : 502;
        return Response.json(
          {
            error: result.error,
            code: result.code,
            message: result.message,
          },
          { status, headers },
        );
      },
    },
  },
});
