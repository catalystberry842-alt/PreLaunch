import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { AllocationBar } from "@/components/allocation-bar";
import { StockAvatar } from "@/components/stock-avatar";
import { StrategySimulator } from "@/components/strategy-simulator";
import { Button } from "@/components/ui/button";
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
import {
  comparePortfolioToBasket,
  portfolioHoldingsFromSnapshot,
} from "@/lib/compare";
import { formatPrice, round1 } from "@/lib/format";
import { getPortfolioFn } from "@/lib/portfolio.functions";
import { cachePortfolioSnapshot, readCachedPortfolio } from "@/lib/portfolio-cache";
import { pageHead } from "@/lib/seo";
import { isSolanaAddress } from "@/lib/solana-address";
import type { Basket } from "@/lib/types";
import type { PortfolioSnapshot } from "@/types/portfolio";
import { cn } from "@/lib/utils";

type CompareSearch = { wallet?: string; basket?: string };

function readParam(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): CompareSearch => ({
    wallet: readParam(search.wallet),
    basket: readParam(search.basket),
  }),
  component: ComparePage,
  head: () =>
    pageHead(
      "Compare",
      "Compare your PreStocks portfolio with a PreLaunch basket. Informational only.",
    ),
});

function formatWeight(value: number) {
  return `${round1(value).toFixed(1)}%`;
}

function formatDelta(portfolioPercent: number, basketPercent: number) {
  const delta = round1(portfolioPercent - basketPercent);
  const body = `${Math.abs(delta).toFixed(1)}%`;
  if (delta > 0) return `+${body}`;
  if (delta < 0) return `−${body}`;
  return body;
}

function ComparePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { stocks } = useCatalog();
  const [list, setList] = useState<Basket[]>([]);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [amount, setAmount] = useState(1000);
  const [scenario, setScenario] = useState(0);
  const [amountReady, setAmountReady] = useState(false);

  const wallet = search.wallet ?? "";
  const basketId = search.basket ?? "";

  useEffect(() => {
    const all = baskets.getAll();
    setList(all);
    if (!search.basket && all[0]) {
      void navigate({
        search: { wallet: search.wallet, basket: all[0].id },
        replace: true,
      });
    }
  }, [search.basket, search.wallet, navigate]);

  const basket = useMemo(
    () => (basketId ? baskets.getById(basketId) ?? list.find((item) => item.id === basketId) : undefined),
    [basketId, list],
  );

  useEffect(() => {
    if (!wallet) {
      setSnapshot(null);
      setPortfolioError(null);
      setPending(false);
      return;
    }
    if (!isSolanaAddress(wallet)) {
      setSnapshot(null);
      setPortfolioError("Portfolio data unavailable");
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
  }, [wallet]);

  useEffect(() => {
    if (!snapshot || amountReady) return;
    if (snapshot.totalValue > 0) setAmount(Math.round(snapshot.totalValue));
    setAmountReady(true);
  }, [snapshot, amountReady]);

  const comparison =
    snapshot && basket
      ? comparePortfolioToBasket(snapshot, basket, stocks)
      : null;
  const portfolioHoldings = snapshot
    ? portfolioHoldingsFromSnapshot(snapshot, stocks)
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="type-kicker">Compare</p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl">
        My Portfolio vs {basket?.name ?? "a basket"}
      </h1>
      <p className="mt-3 max-w-2xl type-lede">
        Informational comparison of live wallet holdings against a PreLaunch
        basket’s reference allocation. This is not a recommendation to buy,
        sell, or rebalance.
      </p>

      <nav className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 type-meta" aria-label="Compare path">
        <Link
          to="/portfolio"
          search={wallet ? { wallet } : undefined}
          className="text-foreground/90 hover:text-foreground"
        >
          Portfolio
        </Link>
        <span aria-hidden="true">→</span>
        <span className="text-foreground">Compare</span>
        {basket ? (
          <>
            <span aria-hidden="true">→</span>
            <Link
              to="/basket/$id"
              params={{ id: basket.id }}
              className="text-foreground/90 hover:text-foreground"
            >
              Basket
            </Link>
            <span aria-hidden="true">→</span>
            <Link
              to="/basket/$id"
              params={{ id: basket.id }}
              hash="simulator"
              className="text-foreground/90 hover:text-foreground"
            >
              Simulator
            </Link>
          </>
        ) : null}
      </nav>

      <div className="mt-8 max-w-xl">
        <Label htmlFor="compare-basket">Basket</Label>
        <Select
          value={basketId || undefined}
          onValueChange={(value) => {
            void navigate({
              search: { wallet: wallet || undefined, basket: value },
            });
          }}
        >
          <SelectTrigger id="compare-basket" className="mt-2" aria-label="Select a basket">
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
      </div>

      {!wallet ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="font-display text-2xl">Paste a wallet to compare</p>
          <p className="mt-2 type-body">
            Open Portfolio, look up a Solana address, then compare those
            holdings with a basket.
          </p>
          <Button asChild className="mt-4">
            <Link to="/portfolio">Go to Portfolio</Link>
          </Button>
        </div>
      ) : null}

      {wallet && pending ? (
        <div className="mt-10" aria-busy="true">
          <p className="font-display text-2xl">Loading portfolio…</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="h-36 animate-pulse rounded-2xl bg-muted" />
            <div className="h-36 animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      ) : null}

      {wallet && !pending && portfolioError ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="font-display text-2xl">Portfolio data unavailable</p>
          <p className="mt-2 type-body">{portfolioError}</p>
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild variant="outline">
              <Link to="/portfolio" search={{ wallet }}>
                Back to Portfolio
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {wallet && !pending && snapshot && !basket ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="font-display text-2xl">Basket not found</p>
          <p className="mt-2 type-body">
            Choose a catalog or saved PreLaunch basket to compare.
          </p>
        </div>
      ) : null}

      {wallet && !pending && snapshot && basket && comparison ? (
        <div className="mt-10 space-y-8">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <p className="type-kicker">My portfolio</p>
              <p className="mt-2 font-display text-3xl tabular-nums">
                {formatPrice(comparison.portfolioValue)}
              </p>
              <p className="mt-1 type-meta">
                Current PreStocks value · {snapshot.positions.length} holding
                {snapshot.positions.length === 1 ? "" : "s"}
              </p>
              {snapshot.positions.length > 0 ? (
                <AllocationBar
                  className="mt-5"
                  segments={snapshot.positions.map((item) => ({
                    id: item.symbol,
                    allocation:
                      comparison.portfolioValue > 0
                        ? (item.value / comparison.portfolioValue) * 100
                        : 0,
                  }))}
                />
              ) : (
                <p className="mt-5 type-body">No PreStocks in this wallet.</p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <p className="type-kicker">Selected basket</p>
              <p className="mt-2 font-display text-3xl">{basket.name}</p>
              <p className="mt-1 type-meta">
                Reference allocation · {basket.constituents.length} PreStock
                {basket.constituents.length === 1 ? "" : "s"}
              </p>
              <AllocationBar
                className="mt-5"
                segments={basket.constituents.map((item) => ({
                  id: item.preStockId,
                  allocation: item.allocation,
                }))}
              />
              <Button asChild variant="outline" className="mt-5">
                <Link to="/basket/$id" params={{ id: basket.id }}>
                  Open basket
                </Link>
              </Button>
            </section>
          </div>

          <section className="grid gap-4 sm:grid-cols-3">
            <CountCard
              label="Overlapping PreStocks"
              count={comparison.overlap.length}
              names={comparison.overlap.map((row) => row.symbol)}
            />
            <CountCard
              label="Only in portfolio"
              count={comparison.portfolioOnly.length}
              names={comparison.portfolioOnly.map((row) => row.symbol)}
            />
            <CountCard
              label="Only in basket"
              count={comparison.basketOnly.length}
              names={comparison.basketOnly.map((row) => row.symbol)}
            />
          </section>

          <section>
            <h2 className="type-card">Allocation differences</h2>
            <p className="mt-1 type-meta">
              Matching PreStocks only. Difference is portfolio weight minus
              basket reference weight.
            </p>
            {comparison.overlap.length === 0 ? (
              <p className="mt-4 type-body">
                No overlapping PreStocks between this wallet and {basket.name}.
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-4 md:hidden">
                  {comparison.overlap.map((row) => (
                    <DifferenceCard key={row.id} row={row} />
                  ))}
                </div>
                <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border md:block">
                  <table className="w-full min-w-[36rem] text-left">
                    <thead>
                      <tr className="border-b border-border type-kicker">
                        <th className="px-4 py-3 font-medium">Asset</th>
                        <th className="px-4 py-3 text-right font-medium">
                          Portfolio %
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Basket %
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Difference
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {comparison.overlap.map((row) => (
                        <tr key={row.id} className="hover:bg-accent/40">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <StockAvatar
                                initials={row.initials}
                                name={row.name}
                                image={row.image}
                                size="sm"
                              />
                              <span>
                                <span className="type-card">{row.name}</span>
                                <span className="ml-2 font-mono type-meta">
                                  {row.symbol}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums">
                            {formatWeight(row.portfolioPercent)}
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums">
                            {formatWeight(row.basketPercent)}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-4 text-right tabular-nums",
                              row.portfolioPercent - row.basketPercent > 0 &&
                                "text-up",
                              row.portfolioPercent - row.basketPercent < 0 &&
                                "text-down",
                            )}
                          >
                            {formatDelta(row.portfolioPercent, row.basketPercent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="type-card">How your portfolio differs</h2>
            <p className="mt-1 type-meta">
              Factual allocation differences only. Not advice.
            </p>
            {comparison.insights.length === 0 ? (
              <p className="mt-4 type-body">
                This wallet’s PreStocks weights match this basket’s reference
                allocation.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {comparison.insights.map((line) => (
                  <li key={line} className="type-copy">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link to="/basket/$id" params={{ id: basket.id }} hash="simulator">
                <FlaskConical />
                Simulate this Basket
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="#simulator">
                <FlaskConical />
                Simulate My Portfolio
              </a>
            </Button>
          </section>

          {portfolioHoldings.length > 0 ? (
            <StrategySimulator
              holdings={portfolioHoldings}
              amount={amount}
              scenario={scenario}
              onAmount={setAmount}
              onScenario={setScenario}
            />
          ) : (
            <p className="type-body">
              This wallet has no PreStocks to simulate.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CountCard({
  label,
  count,
  names,
}: {
  label: string;
  count: number;
  names: string[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4">
      <p className="type-kicker">{label}</p>
      <p className="mt-2 font-display text-2xl tabular-nums">{count}</p>
      <p className="mt-1 type-meta">
        {names.length ? names.join(" · ") : "None"}
      </p>
    </div>
  );
}

function DifferenceCard({
  row,
}: {
  row: {
    id: string;
    symbol: string;
    name: string;
    image: string;
    initials: string;
    portfolioPercent: number;
    basketPercent: number;
    difference: number;
  };
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4">
      <div className="flex items-center gap-3">
        <StockAvatar
          initials={row.initials}
          name={row.name}
          image={row.image}
          size="sm"
        />
        <div>
          <p className="type-card">{row.name}</p>
          <p className="font-mono type-meta">{row.symbol}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 type-meta">
        <div>
          <dt>Portfolio</dt>
          <dd className="mt-1 text-foreground tabular-nums">
            {formatWeight(row.portfolioPercent)}
          </dd>
        </div>
        <div>
          <dt>Basket</dt>
          <dd className="mt-1 text-foreground tabular-nums">
            {formatWeight(row.basketPercent)}
          </dd>
        </div>
        <div>
          <dt>Difference</dt>
          <dd
            className={cn(
              "mt-1 tabular-nums",
              row.portfolioPercent - row.basketPercent > 0 && "text-up",
              row.portfolioPercent - row.basketPercent < 0 && "text-down",
            )}
          >
            {formatDelta(row.portfolioPercent, row.basketPercent)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
