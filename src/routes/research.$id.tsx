import { useEffect, useState, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { BasketCard } from "@/components/basket-card";
import { ChangeValue } from "@/components/change-value";
import {
  CatalogEmpty,
  CatalogError,
  NotFoundState,
} from "@/components/catalog-state";
import { PreStockCardSkeleton } from "@/components/discover-skeletons";
import { StatusBadge } from "@/components/status-badge";
import { StockAvatar } from "@/components/stock-avatar";
import { Button } from "@/components/ui/button";
import { baskets } from "@/lib/baskets";
import { useCatalog } from "@/lib/catalog";
import {
  formatAddress,
  formatCompact,
  formatPrice,
  formatSupply,
} from "@/lib/format";
import { impliedVsMark, tokenVsMark } from "@/lib/premium";
import { relatedBaskets } from "@/lib/prestocks";
import { pageHead } from "@/lib/seo";
import { copyText } from "@/lib/share";
import type { PreStock } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/research/$id")({
  component: ResearchPage,
  head: ({ params }) =>
    pageHead(
      `${params.id.toUpperCase()} research`,
      "Live PreStocks catalog data for this name — token price, mark price, implied valuation, and supply.",
    ),
});

function shortDescription(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const sentence = trimmed.match(/^[^.!?]+[.!?]/);
  if (sentence && sentence[0].length <= 220) return sentence[0].trim();
  if (trimmed.length <= 180) return trimmed;
  return `${trimmed.slice(0, 177).trim()}…`;
}

function ResearchPage() {
  const { id } = Route.useParams();
  const { stocks, stocksError, pending, retry, getBySymbol } = useCatalog();
  const stock = getBySymbol(id);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (pending) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-busy="true">
        <p className="type-kicker">
          Research
        </p>
        <p className="mt-3 font-display text-2xl">Loading PreStock</p>
        <p className="mt-2 type-body">
          Fetching the public PreStocks catalog.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PreStockCardSkeleton />
          <PreStockCardSkeleton />
          <PreStockCardSkeleton />
        </div>
      </div>
    );
  }

  if (stocksError && stocks.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <CatalogError message={stocksError} onRetry={retry} />
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <CatalogEmpty onRetry={retry} />
      </div>
    );
  }

  if (!stock) {
    return (
      <NotFoundState
        title="PreStock not found"
        body="This symbol is not in the PreStocks catalog."
      />
    );
  }

  const related = relatedBaskets(
    stock.id,
    hydrated ? baskets.getAll() : baskets.getCatalog(),
  );
  const tokenVsMarkPct = tokenVsMark(stock);
  const impliedVsMarkPct = impliedVsMark(stock);
  const overview = stock.description.trim();
  const lede = shortDescription(overview);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-kicker">
          Research
        </p>
        <StatusBadge label="Latest data from PreStocks" />
      </div>

      <header className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <StockAvatar
              initials={stock.initials}
              name={stock.name}
              image={stock.image}
              size="lg"
            />
            <div className="min-w-0">
              <h1 className="font-display text-4xl sm:text-5xl">
                {stock.name}
              </h1>
              <p className="mt-2 font-mono type-kicker">
                {stock.symbol} · {stock.category}
              </p>
            </div>
          </div>
          {lede ? (
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground/90">
              {lede}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild>
            <Link to="/create" search={{ add: stock.symbol }}>
              Add to Basket
            </Link>
          </Button>
          {stock.externalUrl ? (
            <Button asChild variant="outline">
              <a href={stock.externalUrl} target="_blank" rel="noreferrer">
                View on PreStocks
                <ExternalLink />
              </a>
            </Button>
          ) : null}
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Token price" value={formatPrice(stock.tokenPrice)} />
        <Stat label="Mark price" value={formatPrice(stock.markPrice)} />
        <Stat
          label="Token vs Mark Price"
          value={
            tokenVsMarkPct == null ? "—" : <ChangeValue className="text-2xl" value={tokenVsMarkPct} />
          }
          hint={`${formatPrice(stock.tokenPrice)} vs ${formatPrice(stock.markPrice)}`}
        />
        <Stat label="Supply" value={formatSupply(stock.supply)} />
        <Stat
          label="Implied valuation"
          value={formatCompact(stock.impliedValuation)}
        />
        <Stat
          label="Mark valuation"
          value={formatCompact(stock.markValuation)}
        />
        <Stat
          label="Implied vs Mark Valuation"
          value={
            impliedVsMarkPct == null ? (
              "—"
            ) : (
              <ChangeValue className="text-2xl" value={impliedVsMarkPct} />
            )
          }
          hint={`${formatCompact(stock.impliedValuation)} vs ${formatCompact(stock.markValuation)}`}
          className="col-span-2"
        />
      </section>
      <p className="mt-3 type-meta">
        Latest data from PreStocks. These figures are catalog values, not a
        PreLaunch mark, forecast, or live trade.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="type-card">Company overview</h2>
          <p className="mt-3 type-copy">
            {overview || "Not available from the PreStocks catalog."}
          </p>
          {stock.externalUrl ? (
            <a
              href={stock.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm text-foreground/90 touch-manipulation hover:underline"
            >
              View on PreStocks
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </section>

        <div className="space-y-6">
          <ContractCard stock={stock} />
        </div>
      </div>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="type-kicker">PreLaunch</p>
            <h2 className="mt-2 font-display text-2xl">Related baskets</h2>
          </div>
          <StatusBadge label="Uses this PreStock" />
        </div>
        {related.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <p className="font-display text-lg">No baskets currently use this PreStock</p>
            <p className="mt-2 type-body">
              Create a basket to include {stock.symbol} in a PreLaunch book.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/create" search={{ add: stock.symbol }}>
                Add to Basket
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((basket) => (
              <BasketCard key={basket.id} basket={basket} variant="catalog" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ContractCard({ stock }: { stock: PreStock }) {
  const [copied, setCopied] = useState(false);
  const address = stock.contractAddress.trim();

  async function copy() {
    if (!address) return;
    const ok = await copyText(address);
    if (ok) {
      setCopied(true);
      toast("Copied");
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      toast("Unable to copy address");
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="type-card">Contract</h2>
      {address ? (
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="type-kicker">
              Contract address
            </p>
            <p className="mt-2 break-all font-mono text-sm leading-relaxed">
              {address}
            </p>
            <p className="mt-2 font-mono type-meta">
              {formatAddress(address)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void copy()}
            aria-label="Copy contract address"
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      ) : (
        <p className="mt-3 type-body">
          Not available from the PreStocks catalog.
        </p>
      )}
    </section>
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
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card px-4 py-4",
        className,
      )}
    >
      <p className="type-kicker">
        {label}
      </p>
      <div className="mt-2 font-display text-2xl tabular-nums">
        {value}
      </div>
      {hint ? (
        <p className="mt-1 truncate type-meta">{hint}</p>
      ) : null}
    </div>
  );
}