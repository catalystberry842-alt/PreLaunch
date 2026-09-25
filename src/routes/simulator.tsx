import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { StatusBadge } from "@/components/status-badge";
import { StrategySimulator } from "@/components/strategy-simulator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { baskets } from "@/lib/baskets";
import { useCatalog } from "@/lib/catalog";
import { portfolioHoldingsFromSnapshot } from "@/lib/compare";
import { getPortfolioFn } from "@/lib/portfolio.functions";
import { cachePortfolioSnapshot, readCachedPortfolio } from "@/lib/portfolio-cache";
import { resolveHoldings } from "@/lib/prestocks";
import { formatAddress } from "@/lib/format";
import { pageHead } from "@/lib/seo";
import { isSolanaAddress } from "@/lib/solana-address";
import type { Basket, BasketHolding } from "@/lib/types";
import type { PortfolioSnapshot } from "@/types/portfolio";

type SimulatorSearch = {
  basket?: string;
  wallet?: string;
  source?: "basket" | "portfolio";
};

function readParam(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const Route = createFileRoute("/simulator")({
  validateSearch: (search: Record<string, unknown>): SimulatorSearch => ({
    basket: readParam(search.basket),
    wallet: readParam(search.wallet),
    source: search.source === "portfolio" ? "portfolio" : search.source === "basket" ? "basket" : undefined,
  }),
  component: SimulatorPage,
  head: () =>
    pageHead(
      "Strategy Simulator",
      "Test hypothetical outcomes for a PreStock basket or portfolio without executing a trade.",
    ),
});

function SimulatorPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { stocks } = useCatalog();
  const [list, setList] = useState<Basket[]>(() => baskets.getCatalog());
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [walletInput, setWalletInput] = useState(search.wallet ?? "");
  const [amount, setAmount] = useState(10000);
  const [amountReady, setAmountReady] = useState(false);

  const source: "basket" | "portfolio" = search.source === "portfolio" ? "portfolio" : "basket";
  const basketId = search.basket ?? "";
  const wallet = search.wallet ?? "";

  useEffect(() => {
    setList(baskets.getAll());
  }, []);

  useEffect(() => {
    setWalletInput(wallet);
  }, [wallet]);

  const basket = useMemo(
    () => (basketId ? baskets.getById(basketId) ?? list.find((item) => item.id === basketId) : undefined),
    [basketId, list],
  );

  useEffect(() => {
    if (source !== "portfolio") {
      setPending(false);
      return;
    }
    if (!wallet) {
      setSnapshot(null);
      setPortfolioError(null);
      setPending(false);
      return;
    }
    if (!isSolanaAddress(wallet)) {
      setSnapshot(null);
      setPortfolioError("Enter a valid Solana wallet address");
      setPending(false);
      return;
    }
    const cached = readCachedPortfolio(wallet);
    if (cached) {
      setSnapshot(cached);
      setPortfolioError(null);
      setPending(false);
    } else {
      setPending(true);
      setPortfolioError(null);
    }
    let cancelled = false;
    void getPortfolioFn({ data: { wallet } })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          if (!cached) {
            setSnapshot(null);
            setPortfolioError("Portfolio data unavailable");
          }
          return;
        }
        cachePortfolioSnapshot(result.snapshot);
        setSnapshot(result.snapshot);
        setPortfolioError(null);
      })
      .catch(() => {
        if (cancelled) return;
        if (!cached) {
          setSnapshot(null);
          setPortfolioError("Portfolio data unavailable");
        }
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, wallet]);

  useEffect(() => {
    if (source !== "portfolio" || !snapshot || amountReady) return;
    if (snapshot.totalValue > 0) setAmount(Math.round(snapshot.totalValue));
    setAmountReady(true);
  }, [source, snapshot, amountReady]);

  const holdings: BasketHolding[] = useMemo(() => {
    if (source === "portfolio") {
      return snapshot ? portfolioHoldingsFromSnapshot(snapshot, stocks) : [];
    }
    return basket ? resolveHoldings(basket.constituents, stocks) : [];
  }, [source, snapshot, basket, stocks]);

  function setSource(next: "basket" | "portfolio") {
    void navigate({
      search: {
        source: next,
        basket: basketId || undefined,
        wallet: wallet || undefined,
      },
    });
  }

  function submitWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = walletInput.trim();
    void navigate({
      search: {
        source: "portfolio",
        basket: basketId || undefined,
        wallet: next || undefined,
      },
    });
  }

  const ready = holdings.length > 0;
  const emptyCopy =
    source === "portfolio"
      ? wallet
        ? pending
          ? "Loading portfolio…"
          : portfolioError || "No PreStocks in this wallet to simulate"
        : "Select a basket or portfolio to begin a simulation"
      : "Select a basket or portfolio to begin a simulation";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-kicker">Simulator</p>
        <StatusBadge label="Hypothetical" />
      </div>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl">Strategy Simulator</h1>
      <p className="mt-3 max-w-2xl type-lede">
        Test hypothetical outcomes for a PreStock basket or portfolio without
        executing a trade.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={source === "basket" ? "default" : "outline"}
          onClick={() => setSource("basket")}
        >
          Basket
        </Button>
        <Button
          type="button"
          variant={source === "portfolio" ? "default" : "outline"}
          onClick={() => setSource("portfolio")}
        >
          Portfolio weights
        </Button>
      </div>

      {source === "basket" ? (
        <div className="mt-6 max-w-xl">
          <Label htmlFor="sim-basket">Basket</Label>
          <Select
            value={basketId || undefined}
            onValueChange={(value) => {
              void navigate({
                search: { source: "basket", basket: value, wallet: wallet || undefined },
              });
            }}
          >
            <SelectTrigger id="sim-basket" className="mt-2" aria-label="Select a basket">
              <SelectValue placeholder="Select a PreLaunch basket" />
            </SelectTrigger>
            <SelectContent>
              {list.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {basket ? (
            <p className="mt-2 type-meta">
              <Link
                to="/basket/$id"
                params={{ id: basket.id }}
                className="text-foreground/90 hover:text-foreground"
              >
                Open {basket.name}
              </Link>
              {" · "}
              {basket.constituents.length} PreStocks
            </p>
          ) : null}
        </div>
      ) : (
        <form className="mt-6 max-w-xl" onSubmit={submitWallet}>
          <Label htmlFor="sim-wallet">Solana wallet address</Label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Input
              id="sim-wallet"
              value={walletInput}
              onChange={(event) => setWalletInput(event.target.value)}
              placeholder="Paste a Solana wallet address"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
            <Button type="submit" className="sm:w-auto sm:shrink-0">
              Use portfolio
            </Button>
          </div>
          <p className="mt-2 type-meta">
            Uses this wallet's current PreStocks weights.
          </p>
        </form>
      )}

      <div className="mt-10">
        {source === "portfolio" && pending ? (
          <p className="font-display text-2xl">Loading portfolio…</p>
        ) : null}
        {source === "portfolio" && !pending && portfolioError ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="font-display text-2xl">{portfolioError}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/portfolio" search={wallet ? { wallet } : undefined}>
                Open Portfolio
              </Link>
            </Button>
          </div>
        ) : null}
        {!pending && !ready && !portfolioError ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="font-display text-2xl">{emptyCopy}</p>
          </div>
        ) : null}
        {!pending && ready ? (
          <StrategySimulator
            holdings={holdings}
            amount={amount}
            onAmount={setAmount}
            title={
              source === "basket"
                ? basket?.name
                : `Portfolio ${formatAddress(wallet)}`
            }
            context={
              source === "basket"
                ? `Basket · ${holdings.length} PreStock${holdings.length === 1 ? "" : "s"}`
                : `Current PreStocks weights · ${holdings.length} position${holdings.length === 1 ? "" : "s"}`
            }
          />
        ) : null}
      </div>

      {source === "portfolio" && snapshot && snapshot.unpricedCount > 0 ? (
        <p className="mt-4 type-meta">
          {snapshot.unpricedCount} unpriced holding
          {snapshot.unpricedCount === 1 ? "" : "s"} excluded.
        </p>
      ) : null}
    </div>
  );
}
