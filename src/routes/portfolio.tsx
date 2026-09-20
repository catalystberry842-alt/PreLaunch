import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AllocationDonut } from "@/components/allocation-donut";
import { EmptyState } from "@/components/empty-state";
import { StockAvatar } from "@/components/stock-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { cachePortfolioSnapshot } from "@/lib/portfolio-cache";
import { formatAddress, formatCostBasis, formatDate, formatPrice, formatQuantity, formatSignedUsd } from "@/lib/format";
import { getPortfolioFn } from "@/lib/portfolio.functions";
import { pageHead } from "@/lib/seo";
import { copyText } from "@/lib/share";
import { isSolanaAddress } from "@/lib/solana-address";
import type { Basket } from "@/lib/types";
import type { PortfolioSnapshot } from "@/types/portfolio";
import { cn } from "@/lib/utils";

type PortfolioSearch = { wallet?: string };

function readWalletParam(value: unknown) {
  if (typeof value !== "string") return undefined;
  let wallet = value.trim();
  if (wallet.length >= 2 && wallet.startsWith('"') && wallet.endsWith('"')) {
    try {
      const parsed = JSON.parse(wallet);
      if (typeof parsed === "string") wallet = parsed.trim();
    } catch {
      wallet = wallet.slice(1, -1).trim();
    }
  }
  return wallet || undefined;
}

export const Route = createFileRoute("/portfolio")({
  validateSearch: (search: Record<string, unknown>): PortfolioSearch => ({
    wallet: readWalletParam(search.wallet),
  }),
  component: PortfolioPage,
  head: () =>
    pageHead(
      "Portfolio",
      "Paste a Solana wallet address to see PreStocks holdings, cost basis, and verified transactions.",
    ),
});

function formatFetchedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function PortfolioPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [input, setInput] = useState(search.wallet ?? "");
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);

  async function load(wallet: string, fresh = false) {
    const trimmed = wallet.trim();
    if (!isSolanaAddress(trimmed)) {
      setInvalid(true);
      setError("Enter a valid Solana wallet address");
      setSnapshot(null);
      setPending(false);
      return;
    }
    setInvalid(false);
    setError(null);
    setPending(true);
    try {
      const result = await getPortfolioFn({ data: { wallet: trimmed, fresh } });
      if (!result.ok) {
        setSnapshot(null);
        setError(result.message);
        if (result.code === "invalid_wallet") setInvalid(true);
        return;
      }
      setSnapshot(result.snapshot);
      cachePortfolioSnapshot(result.snapshot);
      setError(null);
    } catch {
      setSnapshot(null);
      setError("Unable to read this wallet right now.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    const wallet = search.wallet?.trim() ?? "";
    setInput(search.wallet ?? "");
    if (!wallet) {
      setSnapshot(null);
      setError(null);
      setInvalid(false);
      setPending(false);
      return;
    }
    void load(wallet);
  }, [search.wallet]);

  function submit(form: HTMLFormElement) {
    const raw = new FormData(form).get("wallet");
    const wallet = (typeof raw === "string" ? raw : input).trim();
    setInput(wallet);
    if (!isSolanaAddress(wallet)) {
      setInvalid(true);
      setError("Enter a valid Solana wallet address");
      setSnapshot(null);
      return;
    }
    void navigate({
      search: { wallet },
      replace: search.wallet === wallet,
    });
    if (search.wallet === wallet) void load(wallet, true);
  }

  async function copyWallet(wallet: string) {
    const ok = await copyText(wallet);
    toast(ok ? "Address copied" : "Unable to copy address");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="type-kicker">PreStocks</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-4xl">
          {snapshot ? "PreStocks Portfolio" : "Track Your PreStocks"}
        </h1>
      </div>

      {snapshot ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <p className="type-lede">
            Wallet:{" "}
            <span className="font-mono text-foreground">{formatAddress(snapshot.wallet)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyWallet(snapshot.wallet)}
            >
              <Copy />
              Copy Address
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load(snapshot.wallet, true)}
              disabled={pending}
            >
              <RefreshCw />
              Refresh
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 max-w-xl type-lede">
          Paste a Solana address to see PreStocks in that wallet.
        </p>
      )}

      <form
        className="mt-8 max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          submit(event.currentTarget);
        }}
      >
        <Label htmlFor="wallet">Solana wallet address</Label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Input
            id="wallet"
            name="wallet"
            type="text"
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              if (invalid) setInvalid(false);
            }}
            placeholder="Paste a Solana wallet address"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="go"
            className={cn("font-mono", invalid && "ring-2 ring-down/70")}
            aria-invalid={invalid}
            aria-describedby={invalid ? "wallet-error" : undefined}
          />
          <Button type="submit" className="sm:w-auto sm:shrink-0" disabled={pending}>
            View Portfolio
          </Button>
        </div>
        {invalid ? (
          <p id="wallet-error" className="mt-2 text-xs text-down">
            Enter a valid Solana wallet address
          </p>
        ) : null}
      </form>

      {pending ? <LoadingState /> : null}

      {!pending && error && !invalid ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="font-display text-2xl">{error}</p>
          {search.wallet ? (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void load(search.wallet ?? "", true)}
            >
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {!pending &&
      snapshot &&
      snapshot.positions.length === 0 &&
      snapshot.transactions.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No PreStocks found in this wallet"
            body="We couldn't find any PreStocks associated with this Solana wallet."
            actionLabel="Explore PreStocks"
            actionTo="/discover"
          />
        </div>
      ) : null}

      {!pending &&
      snapshot &&
      (snapshot.positions.length > 0 || snapshot.transactions.length > 0) ? (
        <Results snapshot={snapshot} onRefresh={() => void load(snapshot.wallet, true)} />
      ) : null}

      <p className="mt-10 max-w-2xl type-meta leading-relaxed">
        Portfolio values use current PreStocks catalog prices. Cost basis is
        calculated from available wallet transaction history. Transfers and
        transactions with insufficient pricing data are excluded from cost-basis
        calculations. This dashboard does not execute transactions.
      </p>
    </div>
  );
}

function CompareWithBasket({ wallet }: { wallet: string }) {
  const [list, setList] = useState<Basket[]>([]);
  const [basketId, setBasketId] = useState("");

  useEffect(() => {
    const all = baskets.getAll();
    setList(all);
    setBasketId((current) => current || all[0]?.id || "");
  }, []);

  if (list.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="type-card">Compare with a Basket</h2>
      <p className="mt-1 type-meta">
        Informational view of this wallet against a PreLaunch basket’s
        reference allocation.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Label htmlFor="portfolio-compare-basket">Basket</Label>
          <Select value={basketId} onValueChange={setBasketId}>
            <SelectTrigger
              id="portfolio-compare-basket"
              className="mt-2"
              aria-label="Select a basket to compare"
            >
              <SelectValue placeholder="Select a basket" />
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
        <Button asChild className="sm:w-auto" disabled={!basketId}>
          <Link
            to="/compare"
            search={{ wallet, basket: basketId }}
          >
            Compare with a Basket
          </Link>
        </Button>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="mt-10" aria-busy="true" aria-live="polite">
      <p className="font-display text-2xl">Scanning wallet…</p>
      <div className="mt-8 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="h-48 animate-pulse bg-muted/60 p-5" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="h-36 animate-pulse bg-muted/60" />
          <Card className="h-36 animate-pulse bg-muted/60" />
        </div>
      </div>
    </div>
  );
}

function PnlText({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-muted-foreground">Unavailable</span>;
  }
  return (
    <span
      className={
        value > 0 ? "text-up" : value < 0 ? "text-down" : "text-muted-foreground"
      }
    >
      {formatSignedUsd(value)}
    </span>
  );
}

function explorerTxUrl(signature: string) {
  return `https://solscan.io/tx/${encodeURIComponent(signature)}`;
}

function Results({
  snapshot,
  onRefresh,
}: {
  snapshot: PortfolioSnapshot;
  onRefresh: () => void;
}) {
  const { positions, totalValue, fetchedAt, transactions } = snapshot;

  return (
    <div className="mt-10 space-y-8">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="type-kicker">Portfolio summary</p>
        <p className="mt-2 font-display text-4xl tabular-nums">{formatPrice(totalValue)}</p>
        <p className="mt-1 type-meta">Total PreStocks value</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="type-kicker">Total cost basis</p>
            <p className="mt-1 font-display text-xl tabular-nums">
              {formatCostBasis(snapshot.totalCostBasis)}
            </p>
          </div>
          <div>
            <p className="type-kicker">Unrealized P&L</p>
            <p className="mt-1 font-display text-xl tabular-nums">
              <PnlText value={snapshot.unrealizedPnl} />
            </p>
          </div>
          <div>
            <p className="type-kicker">Realized P&L</p>
            <p className="mt-1 font-display text-xl tabular-nums">
              <PnlText value={snapshot.realizedPnl} />
            </p>
          </div>
        </div>
        <p className="mt-4 type-meta">Cost basis method: Average cost</p>
        <p className="mt-1 type-meta">Last updated: {formatFetchedAt(fetchedAt)}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={onRefresh}>
          <RefreshCw />
          Refresh Portfolio
        </Button>
      </section>

      <CompareWithBasket wallet={snapshot.wallet} />

      {positions.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="type-card">Portfolio allocation</h2>
          <AllocationDonut
            className="mt-5"
            segments={positions.map((item) => ({
              id: item.symbol,
              name: item.symbol,
              allocation: item.allocation,
            }))}
          />
        </section>
      ) : null}

      {positions.length > 0 ? (
        <>
          <section className="grid gap-4 md:hidden">
            {positions.map((item) => (
              <PositionCard key={item.symbol} position={item} />
            ))}
          </section>

          <section className="hidden md:block">
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[56rem] text-left">
                <thead>
                  <tr className="border-b border-border type-kicker">
                    <th className="px-4 py-3 font-medium">Asset</th>
                    <th className="px-4 py-3 text-right font-medium">Quantity</th>
                    <th className="px-4 py-3 text-right font-medium">Price</th>
                    <th className="px-4 py-3 text-right font-medium">Value</th>
                    <th className="px-4 py-3 text-right font-medium">Cost basis</th>
                    <th className="px-4 py-3 text-right font-medium">Unrealized P&L</th>
                    <th className="px-4 py-3 text-right font-medium">P&L %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {positions.map((item) => (
                    <tr key={item.symbol} className="hover:bg-accent/40">
                      <td className="px-4 py-4">
                        <Link
                          to="/research/$id"
                          params={{ id: item.symbol }}
                          className="flex min-h-11 items-center gap-3"
                        >
                          <StockAvatar
                            initials={item.initials}
                            name={item.name}
                            image={item.image}
                            size="sm"
                          />
                          <span className="type-card">{item.name}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {formatQuantity(item.quantity)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {formatPrice(item.tokenPrice)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {formatPrice(item.value)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {item.costBasis == null
                          ? "Cost basis unavailable"
                          : formatPrice(item.costBasis)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        <PnlText value={item.unrealizedPnl} />
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {item.unrealizedPnlPercent == null ? (
                          "—"
                        ) : (
                          <span
                            className={
                              item.unrealizedPnlPercent > 0
                                ? "text-up"
                                : item.unrealizedPnlPercent < 0
                                  ? "text-down"
                                  : undefined
                            }
                          >
                            {item.unrealizedPnlPercent > 0 ? "+" : ""}
                            {item.unrealizedPnlPercent.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="type-card">Performance</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="type-kicker">Current value</p>
            <p className="mt-1 font-display text-2xl tabular-nums">{formatPrice(totalValue)}</p>
          </div>
          <div>
            <p className="type-kicker">Cost basis</p>
            <p className="mt-1 font-display text-2xl tabular-nums">
              {formatCostBasis(snapshot.totalCostBasis)}
            </p>
          </div>
          <div>
            <p className="type-kicker">P&L</p>
            <p className="mt-1 font-display text-2xl tabular-nums">
              <PnlText value={snapshot.unrealizedPnl} />
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="type-card">Transactions</h2>
          <p className="mt-1 type-meta">
            PreStocks movements from verified wallet history. Cost basis method:
            Average cost.
          </p>
        </div>
        {snapshot.historyStatus === "unavailable" ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
            <p className="font-display text-xl">
              {snapshot.historyMessage ?? "Unable to load transaction history."}
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
            <p className="font-display text-xl">No PreStocks transactions found</p>
            <p className="mt-2 type-body">
              Available history does not include PreStocks buys, sells, or transfers.
            </p>
          </div>
        ) : (
          <>
            {snapshot.historyTruncated ? (
              <p className="mb-3 type-meta">
                {snapshot.historyMessage ??
                  "Older transactions were not loaded. Cost basis may be incomplete."}
              </p>
            ) : null}
            <div className="grid gap-4 md:hidden">
              {transactions.map((item, index) => (
                <TxCard key={`${item.signature ?? "tx"}-${index}`} tx={item} />
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
              <table className="w-full min-w-[48rem] text-left">
                <thead>
                  <tr className="border-b border-border type-kicker">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Asset</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Quantity</th>
                    <th className="px-4 py-3 text-right font-medium">Price</th>
                    <th className="px-4 py-3 text-right font-medium">Value</th>
                    <th className="px-4 py-3 font-medium">Transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((item, index) => (
                    <tr key={`${item.signature ?? "tx"}-${index}`} className="hover:bg-accent/40">
                      <td className="px-4 py-4 type-body">
                        {item.timestamp ? formatDate(item.timestamp) : "—"}
                      </td>
                      <td className="px-4 py-4 font-mono type-meta">{item.symbol}</td>
                      <td className="px-4 py-4 type-body">{item.typeLabel}</td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {formatQuantity(item.quantity)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {item.unitPriceUsd == null ? "—" : formatPrice(item.unitPriceUsd)}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums">
                        {item.valueUsd == null ? "—" : formatPrice(item.valueUsd)}
                      </td>
                      <td className="px-4 py-4">
                        {item.signature ? (
                          <a
                            href={explorerTxUrl(item.signature)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center gap-1 text-sm hover:underline"
                          >
                            View
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <div>
        <Button asChild>
          <Link to="/discover">Explore Baskets</Link>
        </Button>
      </div>
    </div>
  );
}

function PositionCard({
  position,
}: {
  position: PortfolioSnapshot["positions"][number];
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/research/$id"
          params={{ id: position.symbol }}
          className="flex min-h-11 min-w-0 items-center gap-3"
        >
          <StockAvatar
            initials={position.initials}
            name={position.name}
            image={position.image}
          />
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-tight">{position.name}</p>
            <p className="type-kicker">{position.symbol}</p>
          </div>
        </Link>
      </div>
      <p className="mt-4 type-body">{formatQuantity(position.quantity)} tokens</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="type-kicker">Price</p>
          <p className="mt-1 tabular-nums">{formatPrice(position.tokenPrice)}</p>
        </div>
        <div>
          <p className="type-kicker">Value</p>
          <p className="mt-1 tabular-nums">{formatPrice(position.value)}</p>
        </div>
        <div>
          <p className="type-kicker">Cost basis</p>
          <p className="mt-1 tabular-nums">
            {position.costBasis == null
              ? "Cost basis unavailable"
              : formatPrice(position.costBasis)}
          </p>
        </div>
        <div>
          <p className="type-kicker">Unrealized P&L</p>
          <p className="mt-1 tabular-nums">
            <PnlText value={position.unrealizedPnl} />
          </p>
        </div>
      </div>
      <p className="mt-3 type-meta">
        {position.unrealizedPnlPercent == null
          ? "P&L % unavailable"
          : `${position.unrealizedPnlPercent > 0 ? "+" : ""}${position.unrealizedPnlPercent.toFixed(1)}%`}
      </p>
    </Card>
  );
}

function TxCard({ tx }: { tx: PortfolioSnapshot["transactions"][number] }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-card">{tx.symbol}</p>
          <p className="mt-1 type-meta">{tx.typeLabel}</p>
        </div>
        <p className="type-meta">{tx.timestamp ? formatDate(tx.timestamp) : "—"}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="type-kicker">Quantity</p>
          <p className="mt-1 tabular-nums">{formatQuantity(tx.quantity)}</p>
        </div>
        <div>
          <p className="type-kicker">Price</p>
          <p className="mt-1 tabular-nums">
            {tx.unitPriceUsd == null ? "—" : formatPrice(tx.unitPriceUsd)}
          </p>
        </div>
        <div>
          <p className="type-kicker">Value</p>
          <p className="mt-1 tabular-nums">
            {tx.valueUsd == null ? "—" : formatPrice(tx.valueUsd)}
          </p>
        </div>
        <div>
          <p className="type-kicker">Transaction</p>
          {tx.signature ? (
            <a
              href={explorerTxUrl(tx.signature)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm hover:underline"
            >
              View
              <ExternalLink className="size-3.5" />
            </a>
          ) : (
            <p className="mt-1">—</p>
          )}
        </div>
      </div>
    </Card>
  );
}
