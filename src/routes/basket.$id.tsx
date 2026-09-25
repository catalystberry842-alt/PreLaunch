import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { AllocationBar } from "@/components/allocation-bar";
import { AllocationDonut } from "@/components/allocation-donut";
import { BasketCard } from "@/components/basket-card";
import { EmptyState } from "@/components/empty-state";
import { ShareBasketButton } from "@/components/share-basket";
import { StatusBadge } from "@/components/status-badge";
import { StockAvatar } from "@/components/stock-avatar";
import { StrategySimulator } from "@/components/strategy-simulator";
import { Button } from "@/components/ui/button";
import { baskets } from "@/lib/baskets";
import {
  calculateAllocationStats,
  calculateBasketValue,
} from "@/lib/calculations";
import { useCatalog } from "@/lib/catalog";
import {
  isSaved,
  recordView,
  relatedBaskets,
  toggleSave,
  useCommunity,
} from "@/lib/community";
import { creatorIdFromName } from "@/lib/creators";
import {
  formatCompact,
  formatDate,
  formatPercent,
  formatPrice,
} from "@/lib/format";
import { basketPremium, tokenVsMark } from "@/lib/premium";
import { resolveHoldings } from "@/lib/prestocks";
import { pageHead } from "@/lib/seo";
import type { Basket, BasketHolding } from "@/lib/types";
import { cn } from "@/lib/utils";

type BasketSearch = { launched?: boolean };

export const Route = createFileRoute("/basket/$id")({
  validateSearch: (search: Record<string, unknown>): BasketSearch => ({
    launched:
      search.launched === true ||
      search.launched === "true" ||
      search.launched === "1"
        ? true
        : undefined,
  }),
  component: BasketPage,
  head: ({ params }) => {
    const basket = baskets.getCatalog().find((item) => item.id === params.id);
    return pageHead(
      basket?.name ?? "Basket",
      basket
        ? `${basket.name} — a curated PreStock basket on PreLaunch.`
        : "View a curated PreStock basket on PreLaunch.",
    );
  },
});

function BasketPage() {
  const { id } = Route.useParams();
  const { launched } = Route.useSearch();
  const { stocks } = useCatalog();
  const { ready } = useCommunity();
  const [hydrated, setHydrated] = useState(false);
  const [basket, setBasket] = useState<Basket | undefined>(() =>
    baskets.getCatalog().find((item) => item.id === id),
  );
  const [amount, setAmount] = useState(10000);

  useEffect(() => {
    setHydrated(true);
    const next = baskets.getById(id);
    setBasket(next);
    if (next) recordView(next);
  }, [id]);

  const holdings = useMemo(
    () => (basket ? resolveHoldings(basket.constituents, stocks) : []),
    [basket, stocks],
  );
  const stats = useMemo(() => calculateAllocationStats(holdings), [holdings]);
  const weightedImplied = calculateBasketValue(
    holdings.map((item) => ({
      allocation: item.allocation,
      value: item.stock?.impliedValuation ?? null,
    })),
  );
  const premium = basketPremium(holdings);

  if (!basket) {
    if (!hydrated) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-busy="true">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-10 w-2/3 max-w-md animate-pulse rounded bg-muted" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
            <div className="col-span-2 h-24 animate-pulse rounded-xl bg-muted lg:col-span-1" />
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <h1 className="font-display text-4xl">Basket not found</h1>
        <p className="mt-3 type-lede">
          This basket is not in the catalog or saved in this browser.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link to="/discover">Back to Discover</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/create">Create a Basket</Link>
          </Button>
        </div>
      </div>
    );
  }

  const saved = ready && isSaved(basket.id);
  const related = relatedBaskets(baskets.getAll(), basket, 3);

  const largest = holdings.reduce<BasketHolding | null>(
    (current, item) =>
      !current || item.allocation > current.allocation ? item : current,
    null,
  );
  const structureBody = stats.isComplete
    ? `${stats.count} PreStocks, fully allocated at 100%. Largest position ${stats.largest}%, smallest ${stats.smallest}%, average ${stats.average}%.`
    : `${stats.count} PreStocks. Allocation total: ${stats.total}%. ${stats.remaining > 0 ? `${stats.remaining}% remaining` : `${Math.abs(stats.remaining)}% over 100%`}.`;

  return (
    <>
      {launched ? (
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
            <p className="type-card">Published in this browser</p>
          </div>
        </div>
      ) : null}
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="type-kicker">
              {basket.category}
            </p>
            {basket.source === "local" ? (
              <StatusBadge label="Published here" />
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="font-display text-4xl sm:text-5xl">
                {basket.name}
              </h1>
              <p className="mt-3 type-lede">
                {basket.description}
              </p>
              <p className="mt-4 type-body">
                <Link
                  to="/creator/$id"
                  params={{ id: creatorIdFromName(basket.creator) }}
                  className="text-foreground/90 hover:text-foreground"
                >
                  {basket.creator}
                </Link>
                {" · "}
                {basket.constituents.length} PreStocks ·{" "}
                {formatDate(basket.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/simulator" search={{ basket: basket.id }}>
                  <FlaskConical />
                  Simulate Basket
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/compare" search={{ basket: basket.id }}>
                  Compare Portfolio
                </Link>
              </Button>
              <Button
                type="button"
                variant={saved ? "secondary" : "outline"}
                onClick={() => {
                  const result = toggleSave(basket);
                  if (result.error) {
                    toast(result.error);
                    return;
                  }
                  toast(
                    result.saved
                      ? "Saved to this browser"
                      : "Removed from Saved",
                  );
                }}
              >
                {saved ? <BookmarkCheck /> : <Bookmark />}
                {saved ? "Saved" : "Save Basket"}
              </Button>
              <ShareBasketButton basket={basket} />
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="PreStocks" value={String(stats.count)} />
            <Stat
              label="Largest allocation"
              value={stats.largest == null ? "—" : `${stats.largest}%`}
            />
            <Stat
              label="Smallest allocation"
              value={stats.smallest == null ? "—" : `${stats.smallest}%`}
            />
            <Stat
              label="Average allocation"
              value={stats.average == null ? "—" : `${stats.average}%`}
            />
            <Stat
              label="Token vs mark"
              value={premium.value == null ? "—" : formatPercent(premium.value)}
              hint={
                premium.value == null
                  ? "Catalog prices unavailable"
                  : `Weighted by allocation${premium.covered < premium.total ? ` · ${premium.covered} of ${premium.total} priced` : ""}`
              }
              className="col-span-2 lg:col-span-1"
            />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
        <section
          id="research"
          className="scroll-mt-[calc(3.75rem+env(safe-area-inset-top,0px))] rounded-2xl border border-border bg-card p-5 sm:p-6"
        >
          <h2 className="type-card">Basket thesis</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <Block title="Why this basket exists" body={basket.description} />
            <Block
              title="What theme it represents"
              body={`${basket.category} · ${holdings.length} names. Inclusion is structural, not a recommendation.`}
            />
            <Block title="How the allocation is structured" body={structureBody} />
          </div>
          <div className="mt-6 border-t border-border pt-6">
            <h3 className="type-kicker">
              Creator thesis
            </h3>
            <p className="mt-2 type-copy">
              {basket.thesis.trim() || "No thesis provided"}
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <AllocationBreakdown holdings={holdings} stats={stats} />
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="type-card">Basket composition</h2>
            <AllocationDonut
              className="mt-5"
              segments={holdings.map((item) => ({
                id: item.preStockId,
                name: item.stock?.name ?? item.preStockId,
                allocation: item.allocation,
              }))}
            />
            <p className="mt-4 type-meta">
              Weighted implied valuation (catalog):{" "}
              {weightedImplied == null ? "Data unavailable" : formatCompact(weightedImplied)}
              {" · "}Weighted token vs mark:{" "}
              {premium.value == null ? "Data unavailable" : formatPercent(premium.value)}
              . Token vs mark = (token price − mark price) ÷ mark price, from the
              PreStocks catalog. This is not a NAV or tradable basket price.
            </p>
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="type-card">Holdings</h2>
          <div className="mt-6 space-y-5">
            {holdings.map((item) => (
              <div key={item.preStockId} className="border-t border-border pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="type-card">
                      {item.stock?.name ?? item.preStockId}
                    </p>
                    <p className="mt-1 type-meta">
                      {item.stock
                        ? `${item.stock.symbol} · ${item.stock.category}`
                        : "Data unavailable"}{" "}
                      · {item.allocation}% allocation
                    </p>
                  </div>
                  {item.stock ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/research/$id" params={{ id: item.stock.id }}>
                        Research
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <p className="mt-2 type-copy">
                  {item.stock?.description ??
                    "This name is not in the live catalog right now."}
                </p>
              </div>
            ))}
          </div>
        </section>

        <StrategySimulator
          holdings={holdings}
          amount={amount}
          onAmount={setAmount}
          title={basket.name}
          context={`Basket · ${holdings.length} PreStock${holdings.length === 1 ? "" : "s"} · ${basket.category}`}
        />

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="type-kicker">
                More on PreLaunch
              </p>
              <h2 className="mt-2 font-display text-2xl">
                Related baskets
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/discover">Explore Baskets</Link>
            </Button>
          </div>
          <div className="mt-6">
            {related.length === 0 ? (
              <EmptyState
                title="No related baskets"
                body="No other PreLaunch books share this category yet."
                actionLabel="Explore Baskets"
                actionTo="/discover"
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <BasketCard key={item.id} basket={item} />
                ))}
              </div>
            )}
          </div>
        </section>

        <p className="type-meta leading-relaxed">
          {largest
            ? `${largest.stock?.name ?? largest.preStockId} is the largest position at ${largest.allocation}%. `
            : null}
          PreStocks are economic exposure, not ownership. This page is not
          financial advice.
        </p>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card px-4 py-4", className)}>
      <p className="type-kicker">
        {label}
      </p>
      <div className="mt-2 font-display text-2xl tabular-nums">
        {value}
      </div>
      {hint ? (
        <p className="mt-1 type-meta">{hint}</p>
      ) : null}
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="type-kicker">
        {title}
      </h3>
      <p className="mt-2 type-copy">{body}</p>
    </div>
  );
}

function AllocationBreakdown({
  holdings,
  stats,
}: {
  holdings: BasketHolding[];
  stats: ReturnType<typeof calculateAllocationStats>;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-card">Allocation breakdown</h2>
        <p className="type-body tabular-nums">
          Allocation total: {stats.total}%
          {stats.remaining > 0
            ? ` · ${stats.remaining}% remaining`
            : stats.remaining < 0
              ? ` · ${Math.abs(stats.remaining)}% over 100%`
              : ""}
        </p>
      </div>
      <AllocationBar
        className="mt-4 h-2.5"
        segments={holdings.map((item) => ({
          id: item.preStockId,
          allocation: item.allocation,
        }))}
      />
      <div className="mt-5 hidden grid-cols-[1.3fr_0.55fr_0.8fr_0.65fr_0.8fr] gap-3 px-1 type-kicker md:grid">
        <span>Company</span>
        <span className="text-right">Allocation</span>
        <span className="text-right">Token price</span>
        <span className="text-right">Vs mark</span>
        <span className="text-right">Implied val.</span>
      </div>
      <div className="mt-2 divide-y divide-border md:border-t md:border-border">
        {holdings.map((item) => {
          const stock = item.stock;
          const premiumPct = stock ? tokenVsMark(stock) : null;
          return (
            <div
              key={item.preStockId}
              className="grid gap-2 py-4 md:grid-cols-[1.3fr_0.55fr_0.8fr_0.65fr_0.8fr] md:items-center md:gap-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <StockAvatar
                  initials={stock?.initials ?? "?"}
                  name={stock?.name ?? item.preStockId}
                  image={stock?.image}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate type-card">
                    {stock?.name ?? item.preStockId}
                  </p>
                  <p className="font-mono type-meta">
                    {stock?.symbol ?? item.preStockId}
                  </p>
                </div>
              </div>
              <p className="text-sm tabular-nums md:text-right">
                {item.allocation}%
              </p>
              <div className="flex justify-between text-sm md:block md:text-right">
                <span className="type-kicker md:hidden">
                  Token price
                </span>
                <span className="tabular-nums">
                  {stock ? formatPrice(stock.tokenPrice) : "Data unavailable"}
                </span>
              </div>
              <div className="flex justify-between text-sm md:block md:text-right">
                <span className="type-kicker md:hidden">
                  Token vs mark
                </span>
                <span
                  className="tabular-nums"
                  title={stock ? `${formatPrice(stock.tokenPrice)} vs ${formatPrice(stock.markPrice)} mark` : undefined}
                >
                  {premiumPct == null ? "—" : formatPercent(premiumPct)}
                </span>
              </div>
              <div className="flex justify-between text-sm md:block md:text-right">
                <span className="type-kicker md:hidden">
                  Implied valuation
                </span>
                <span className="tabular-nums">
                  {stock
                    ? formatCompact(stock.impliedValuation)
                    : "Data unavailable"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

