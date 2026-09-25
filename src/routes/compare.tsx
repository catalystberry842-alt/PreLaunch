import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { AllocationBar } from "@/components/allocation-bar";
import { StockAvatar } from "@/components/stock-avatar";
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
import { comparePortfolioToBasket, type CompareRow, type CompareSide } from "@/lib/compare";
import { round1, formatPrice } from "@/lib/format";
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

function sideLabel(side: CompareSide) {
  if (side === "both") return "Overlapping";
  if (side === "portfolio") return "Only in portfolio";
  return "Only in basket";
}

function ComparePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { stocks } = useCatalog();
  const [list, setList] = useState<Basket[]>(() => baskets.getCatalog());
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [walletInput, setWalletInput] = useState(search.wallet ?? "");

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

  useEffect(() => {
    setWalletInput(wallet);
  }, [wallet]);

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
  }, [wallet]);

  const comparison =
    snapshot && basket
      ? comparePortfolioToBasket(snapshot, basket, stocks)
      : null;

  function submitWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = walletInput.trim();
    void navigate({
      search: {
        wallet: next || undefined,
        basket: basketId || undefined,
      },
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="type-kicker">Compare</p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl">
        Your Portfolio vs {basket?.name ?? "a Basket"}
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
              to="/simulator"
              search={{ basket: basket.id }}
              className="text-foreground/90 hover:text-foreground"
            >
              Simulator
            </Link>
          </>
        ) : null}
      </nav>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={submitWallet}>
          <Label htmlFor="compare-wallet">Your Portfolio</Label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Input
              id="compare-wallet"
              value={walletInput}
              onChange={(event) => setWalletInput(event.target.value)}
              placeholder="Paste a Solana wallet address"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
            <Button type="submit" className="sm:w-auto sm:shrink-0">
              Use wallet
            </Button>
          </div>
          <p className="mt-2 type-meta">
            Live PreStocks weights from this wallet. Not a trade.
          </p>
        </form>

        <div>
          <Label htmlFor="compare-basket">A Basket</Label>
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
      </div>

      {!wallet ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="font-display text-2xl">Enter a Solana wallet to compare your portfolio with a basket</p>
          <p className="mt-2 type-body">
            Paste an address above, or look one up on Portfolio first.
          </p>
          <Button asChild variant="outline" className="mt-4">
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
          <p className="font-display text-2xl">{portfolioError}</p>
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
              <p className="type-kicker">Your Portfolio</p>
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
                      comparison.portfolioValue > 0 && item.value != null
                        ? (item.value / comparison.portfolioValue) * 100
                        : 0,
                  }))}
                />
              ) : (
                <p className="mt-5 type-body">No PreStocks in this wallet.</p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <p className="type-kicker">A Basket</p>
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
            <h2 className="type-card">Allocation comparison</h2>
            <p className="mt-1 type-meta">
              Difference = portfolio allocation % − basket allocation %.
              Informational only.
            </p>
            {comparison.rows.length === 0 ? (
              <p className="mt-4 type-body">
                No PreStocks in this wallet or basket to compare.
              </p>
            ) : (
              <>
                <div className="mt-4 grid gap-4 md:hidden">
                  {comparison.rows.map((row) => (
                    <DifferenceCard key={row.id} row={row} />
                  ))}
                </div>
                <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border md:block">
                  <table className="w-full min-w-[40rem] text-left">
                    <thead>
                      <tr className="border-b border-border type-kicker">
                        <th className="px-4 py-3 font-medium">Asset</th>
                        <th className="px-4 py-3 font-medium">Presence</th>
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
                      {comparison.rows.map((row) => (
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
                          <td className="px-4 py-4 type-meta">
                            {sideLabel(row.side)}
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
                              row.difference > 0 && "text-up",
                              row.difference < 0 && "text-down",
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
              <Link to="/simulator" search={{ basket: basket.id }}>
                <FlaskConical />
                Simulate this Basket
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link
                to="/simulator"
                search={{ source: "portfolio", wallet: wallet || undefined }}
              >
                <FlaskConical />
                Simulate My Portfolio
              </Link>
            </Button>
          </section>
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

function DifferenceCard({ row }: { row: CompareRow }) {
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
          <p className="font-mono type-meta">
            {row.symbol} · {sideLabel(row.side)}
          </p>
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
              row.difference > 0 && "text-up",
              row.difference < 0 && "text-down",
            )}
          >
            {formatDelta(row.portfolioPercent, row.basketPercent)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
