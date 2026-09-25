import { useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { AllocationBar } from "@/components/allocation-bar";
import { AllocationDonut } from "@/components/allocation-donut";
import { StatusBadge } from "@/components/status-badge";
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
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_CREATOR, baskets, emptyDraft } from "@/lib/baskets";
import { CatalogError } from "@/components/catalog-state";
import { useCatalog } from "@/lib/catalog";
import {
  CATEGORIES,
  type Basket,
  type BasketDraft,
  type Category,
  type FilterCategory,
  type PreStock,
} from "@/lib/types";
import {
  draftAllocationEntries,
  validateAllocations,
} from "@/lib/basket-validation";
import { equalAllocations, round1, setAllocation } from "@/lib/format";
import { rememberPublishedBasket } from "@/lib/community";
import { canonicalizePreStockId } from "@/lib/prestock-meta";
import { searchPreStocks } from "@/lib/prestocks";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

type CreateSearch = { add?: string };

export const Route = createFileRoute("/create")({
  validateSearch: (search: Record<string, unknown>): CreateSearch => ({
    add: typeof search.add === "string" ? search.add : undefined,
  }),
  component: CreatePage,
  head: () =>
    pageHead(
      "Create a Basket",
      "Select PreStocks, set allocations, write a thesis, and publish a basket on PreLaunch in this browser.",
    ),
});

const THESIS_MAX = 500;

function CreatePage() {
  const { add } = Route.useSearch();
  const navigate = useNavigate();
  const { stocks, stocksError, pending, retry } = useCatalog();
  const [draft, setDraft] = useState<BasketDraft>(() => emptyDraft());
  const [hydrated, setHydrated] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [step, setStep] = useState<"edit" | "confirm" | "success">("edit");
  const [launched, setLaunched] = useState<Basket | null>(null);
  const skipDraftWrite = useRef(false);
  const draftRef = useRef(draft);
  const draftTimer = useRef(0);
  draftRef.current = draft;

  useEffect(() => {
    const saved = baskets.readDraft();
    if (saved) setDraft(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !add) return;
    const id = canonicalizePreStockId(add);
    setDraft((current) => {
      if (current.selectedIds.includes(id)) return current;
      const selectedIds = [...current.selectedIds, id];
      return {
        ...current,
        selectedIds,
        allocations: equalAllocations(selectedIds),
      };
    });
  }, [add, hydrated]);

  useEffect(() => {
    if (!hydrated || skipDraftWrite.current) return;
    const timer = window.setTimeout(() => {
      if (!skipDraftWrite.current) baskets.writeDraft(draft);
      draftTimer.current = 0;
    }, 200);
    draftTimer.current = timer;
    return () => {
      window.clearTimeout(timer);
      draftTimer.current = 0;
    };
  }, [draft, hydrated]);

  useEffect(() => {
    return () => {
      if (!skipDraftWrite.current) baskets.writeDraft(draftRef.current);
    };
  }, []);

  const selected = useMemo(
    () =>
      draft.selectedIds
        .map((id) => {
          const canonical = canonicalizePreStockId(id);
          return stocks.find((stock) => stock.id === canonical);
        })
        .filter((stock): stock is PreStock => Boolean(stock)),
    [stocks, draft.selectedIds],
  );

  const issues = baskets.validateDraft(draft);
  const ready = issues.length === 0;
  // Totals cover the selected PreStocks only, matching what gets published.
  const allocationEntries = draftAllocationEntries(draft.selectedIds, draft.allocations);
  const total = round1(
    allocationEntries.reduce((sum, entry) => sum + (entry.allocation ?? 0), 0),
  );
  const remaining = round1(100 - total);
  const allocationValid = validateAllocations(allocationEntries).length === 0;

  function patch<K extends keyof BasketDraft>(key: K, value: BasketDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function addStock(id: string) {
    const canonical = canonicalizePreStockId(id);
    setDraft((current) => {
      if (current.selectedIds.includes(canonical)) return current;
      const selectedIds = [...current.selectedIds, canonical];
      return {
        ...current,
        selectedIds,
        allocations: equalAllocations(selectedIds),
      };
    });
  }

  function removeStock(id: string) {
    setDraft((current) => {
      const selectedIds = current.selectedIds.filter((item) => item !== id);
      return {
        ...current,
        selectedIds,
        allocations: equalAllocations(selectedIds),
      };
    });
  }

  function reviewLaunch() {
    setAttempted(true);
    if (baskets.validateDraft(draft).length > 0) {
      window.requestAnimationFrame(() => {
        document.getElementById("launch")?.scrollIntoView({ block: "center" });
      });
      return;
    }
    setStep("confirm");
    window.scrollTo(0, 0);
  }

  function confirmLaunch() {
    setAttempted(true);
    if (baskets.validateDraft(draft).length > 0) {
      setStep("edit");
      return;
    }
    skipDraftWrite.current = true;
    if (draftTimer.current) {
      window.clearTimeout(draftTimer.current);
      draftTimer.current = 0;
    }
    try {
      const result = baskets.publish(draft);
      baskets.clearDraft();
      rememberPublishedBasket(result.basket);
      setLaunched(result.basket);
      setStep("success");
      window.scrollTo(0, 0);
    } catch (error) {
      skipDraftWrite.current = false;
      toast(
        error instanceof Error
          ? error.message
          : "Unable to publish this basket in the browser.",
      );
    }
  }

  if (step === "success" && launched) {
    return (
      <LaunchSuccess
        basket={launched}
        selected={selected}
        onExplore={() => navigate({ to: "/discover", search: { tab: "baskets" } })}
      />
    );
  }

  if (step === "confirm") {
    return (
      <LaunchConfirm
        draft={draft}
        selected={selected}
        total={total}
        onBack={() => setStep("edit")}
        onLaunch={confirmLaunch}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-28 sm:px-6 lg:pb-10">
      <p className="type-kicker">
        New basket
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-4xl">Create a Basket</h1>
      </div>

      {stocksError ? (
        <div className="mt-10">
          <CatalogError message={stocksError} onRetry={retry} />
        </div>
      ) : null}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="type-card">Basic information</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="basket-name">Basket name</Label>
                <Input
                  id="basket-name"
                  value={draft.name}
                  onChange={(event) => patch("name", event.target.value)}
                  placeholder="e.g. AI Infrastructure"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="basket-description">Short description</Label>
                <Input
                  id="basket-description"
                  value={draft.description}
                  onChange={(event) => patch("description", event.target.value)}
                  placeholder="What is this basket focused on?"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(value) => patch("category", value as Category)}
                >
                  <SelectTrigger aria-label="Category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="type-kicker">Creator</p>
                <p className="type-body">{draft.creator || DEFAULT_CREATOR}</p>
                <p className="type-meta">
                  Shown as the publisher of this basket in this browser.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="type-card">Select PreStocks</h2>
            <div className="mt-4">
              <StockPicker
                stocks={stocks}
                selectedIds={draft.selectedIds}
                onAdd={addStock}
                onRemove={removeStock}
                loading={pending && stocks.length === 0 && !stocksError}
              />
            </div>
          </section>

          <section>
            <h2 className="type-card">Selected PreStocks</h2>
            <SelectedList stocks={selected} onRemove={removeStock} />
          </section>

          <section>
            <h2 className="type-card">Set Allocations</h2>
            <div className="mt-4">
              <AllocationEditor
                stocks={selected}
                allocations={draft.allocations}
                total={total}
                remaining={remaining}
                onChange={(id, value) =>
                  setDraft((current) => ({
                    ...current,
                    allocations: setAllocation(current.allocations, id, value),
                  }))
                }
                onEqual={() =>
                  setDraft((current) => ({
                    ...current,
                    allocations: equalAllocations(current.selectedIds),
                  }))
                }
              />
            </div>
          </section>

          <section>
            <h2 className="type-card">Allocation mix</h2>
            <div className="mt-4 rounded-xl border border-border p-4 sm:p-5">
              <AllocationDonut
                segments={selected.map((stock) => ({
                  id: stock.id,
                  name: stock.name,
                  allocation: draft.allocations[stock.id] ?? 0,
                }))}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="thesis">Your Thesis</Label>
              </div>
              <span className="type-meta tabular-nums">
                {draft.thesis.length} / {THESIS_MAX}
              </span>
            </div>
            <Textarea
              id="thesis"
              maxLength={THESIS_MAX}
              value={draft.thesis}
              onChange={(event) => patch("thesis", event.target.value)}
              placeholder="What is the idea behind this basket?"
              className="mt-3 min-h-36"
            />
          </section>

          <section id="launch" className="rounded-2xl border border-border bg-card p-5">
            <h2 className="type-card">Publish</h2>
            <p className="mt-1 type-meta">
              Publishing shares this strategy idea inside PreLaunch (saved in
              this browser). It does not create a token, liquidity, an order,
              or a blockchain transaction.
            </p>
            {issues.length > 0 ? (
              <ul
                className={cn(
                  "mt-4 space-y-1.5 text-sm",
                  attempted
                    ? "rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-down"
                    : "text-muted-foreground",
                )}
              >
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-up">Ready to publish</p>
            )}
            <Button
              type="button"
              className="mt-5 w-full sm:w-auto"
              onClick={reviewLaunch}
            >
              Publish basket
            </Button>
          </section>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <DraftPreview
            draft={draft}
            selected={selected}
            total={total}
            remaining={remaining}
            valid={allocationValid}
          />
        </aside>
      </div>

      <div className="pointer-events-none fixed inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 shadow-[var(--shadow-elevated)] lg:hidden">
        <p className="min-w-0 truncate type-body">
          {ready ? "Ready to publish" : `${issues.length} item${issues.length === 1 ? "" : "s"} left`}
        </p>
        <Button type="button" className="pointer-events-auto" onClick={reviewLaunch}>
          Publish basket
        </Button>
      </div>
    </div>
  );
}

function StockPicker({
  stocks,
  selectedIds,
  onAdd,
  onRemove,
  loading = false,
}: {
  stocks: PreStock[];
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("All");
  const visible = searchPreStocks(stocks, query, filter);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search companies or symbols"
          className="pl-10"
          aria-label="Search PreStocks"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>
      <div className="hide-scrollbar -mx-1 mt-3 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
        {(["All", ...CATEGORIES] as FilterCategory[]).map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={filter === item ? "default" : "outline"}
            className="shrink-0"
            onClick={() => setFilter(item)}
          >
            {item}
          </Button>
        ))}
      </div>
      <p className="mt-3 type-body">
        {selectedIds.length === 0
          ? "None selected yet."
          : `${selectedIds.length} selected`}
      </p>
      {loading ? (
        <div className="mt-3 space-y-2 rounded-xl border border-border px-4 py-4" aria-busy="true">
          <p className="type-body">Loading PreStocks…</p>
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border px-4 py-10 text-center type-body">
          No PreStocks match this search.
        </div>
      ) : (
        <div className="mt-3 divide-y divide-border rounded-xl border border-border">
          {visible.map((stock) => {
            const selected = selectedIds.includes(stock.id);
            return (
              <div
                key={stock.id}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3",
                  selected && "bg-secondary/40",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <StockAvatar
                    initials={stock.initials}
                    name={stock.name}
                    image={stock.image}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate type-card">{stock.name}</p>
                    <p className="type-meta">
                      {stock.symbol} · {stock.category}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={selected ? "secondary" : "outline"}
                  onClick={() =>
                    selected ? onRemove(stock.id) : onAdd(stock.id)
                  }
                >
                  {selected ? "Selected" : "Select"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SelectedList({
  stocks,
  onRemove,
}: {
  stocks: PreStock[];
  onRemove: (id: string) => void;
}) {
  if (stocks.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-10 text-center type-body">
        Selected companies will appear here.
      </div>
    );
  }

  return (
    <div className="mt-4 divide-y divide-border rounded-xl border border-border">
      {stocks.map((stock) => (
        <div
          key={stock.id}
          className="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <StockAvatar
              initials={stock.initials}
              name={stock.name}
              image={stock.image}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate type-card">{stock.name}</p>
              <p className="type-meta">
                {stock.symbol} · {stock.category}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onRemove(stock.id)}
            aria-label={`Remove ${stock.name}`}
          >
            <X />
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
}

function AllocationEditor({
  stocks,
  allocations,
  total,
  remaining,
  onChange,
  onEqual,
}: {
  stocks: PreStock[];
  allocations: Record<string, number>;
  total: number;
  remaining: number;
  onChange: (id: string, value: number) => void;
  onEqual: () => void;
}) {
  if (stocks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center type-body">
        Select PreStocks to set allocations.
      </div>
    );
  }

  const valid = Math.abs(total - 100) < 0.05;

  return (
    <div className="rounded-xl border border-border">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="type-body">
          <p>
            Allocation total:{" "}
            <span
              className={cn(
                "tabular-nums font-medium",
                valid ? "text-up" : "text-foreground",
              )}
            >
              {total}%
            </span>
          </p>
          <p>
            {remaining > 0
              ? `${remaining}% remaining`
              : remaining < 0
                ? `${Math.abs(remaining)}% over 100%`
                : "Exactly 100%"}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onEqual}>
          Equal weights
        </Button>
      </div>
      <div className="divide-y divide-border">
        {stocks.map((stock) => {
          const value = allocations[stock.id] ?? 0;
          return (
            <div key={stock.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate type-card">{stock.name}</p>
                  <p className="type-meta">{stock.symbol}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    inputMode="decimal"
                    value={value}
                    onChange={(event) =>
                      onChange(stock.id, Number(event.target.value) || 0)
                    }
                    className="h-11 w-24 tabular-nums"
                    aria-label={`${stock.name} allocation`}
                  />
                  <span className="type-body">%</span>
                </div>
              </div>
              <div className="flex h-11 items-center">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={value}
                  onChange={(event) =>
                    onChange(stock.id, Number(event.target.value))
                  }
                  className="w-full cursor-pointer accent-primary"
                  aria-label={`${stock.name} allocation slider`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DraftPreview({
  draft,
  selected,
  total,
  remaining,
  valid,
}: {
  draft: BasketDraft;
  selected: PreStock[];
  total: number;
  remaining: number;
  valid: boolean;
}) {
  const segments = selected.map((stock) => ({
    id: stock.id,
    name: stock.name,
    allocation: draft.allocations[stock.id] ?? 0,
  }));

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-kicker">
          Basket Preview
        </p>
      </div>
      <h2 className="mt-4 font-display text-2xl leading-tight">
        {draft.name.trim() || "Untitled basket"}
      </h2>
      <p className="mt-2 type-body">
        {draft.category} · {draft.creator || DEFAULT_CREATOR} · {selected.length}{" "}
        PreStocks
      </p>
      <p className="mt-3 type-body">
        {draft.description.trim() ||
          "Add a short description to preview how the basket will read."}
      </p>
      <div className="mt-5">
        <p className="type-kicker">
          Thesis
        </p>
        <p className="mt-2 type-copy">
          {draft.thesis.trim() || "Your thesis will appear here."}
        </p>
      </div>
      <div className="mt-5 space-y-2">
        {selected.length === 0 ? (
          <p className="type-body">No names selected yet.</p>
        ) : (
          selected.map((stock) => (
            <div
              key={stock.id}
              className="flex items-center justify-between gap-3"
            >
              <span className="truncate pr-3 type-card">
                {stock.name}{" "}
                <span className="font-normal type-meta">{stock.symbol}</span>
              </span>
              <span className="tabular-nums type-meta">
                {draft.allocations[stock.id] ?? 0}%
              </span>
            </div>
          ))
        )}
      </div>
      <AllocationBar className="mt-4" segments={segments} />
      <div className="mt-5 flex items-center justify-between type-body">
        <span>Allocation total</span>
        <span className={cn("tabular-nums font-medium", valid && "text-up")}>
          {total}%
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between type-meta">
        <span>
          {remaining > 0
            ? `${remaining}% remaining`
            : remaining < 0
              ? `${Math.abs(remaining)}% over 100%`
              : "Exactly 100%"}
        </span>
      </div>
    </Card>
  );
}

function LaunchConfirm({
  draft,
  selected,
  total,
  onBack,
  onLaunch,
}: {
  draft: BasketDraft;
  selected: PreStock[];
  total: number;
  onBack: () => void;
  onLaunch: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="type-kicker">
        Confirm
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-4xl">Publish basket</h1>
        <StatusBadge label="This browser" />
      </div>
      <p className="mt-3 type-lede">
        Review the book. Publishing saves this strategy idea on PreLaunch in
        this browser. It does not create a token, liquidity, an order, or a
        blockchain transaction.
      </p>

      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="type-kicker">
            {draft.category}
          </p>
          <StatusBadge label="Ready to publish" />
        </div>
        <h2 className="mt-3 font-display text-3xl leading-tight">{draft.name}</h2>
        <p className="mt-2 type-body">
          {draft.creator} · {selected.length} PreStocks · {total}% allocated
        </p>
        <p className="mt-4 type-copy">
          {draft.description}
        </p>
        <div className="mt-6">
          <p className="type-kicker">
            Thesis
          </p>
          <p className="mt-2 type-copy">{draft.thesis}</p>
        </div>
        <div className="mt-6 space-y-2">
          {selected.map((stock) => (
            <div
              key={stock.id}
              className="flex items-center justify-between gap-3"
            >
              <span className="truncate type-card">
                {stock.name}{" "}
                <span className="font-normal type-meta">{stock.symbol}</span>
              </span>
              <span className="tabular-nums type-meta">
                {draft.allocations[stock.id] ?? 0}%
              </span>
            </div>
          ))}
        </div>
        <AllocationBar
          className="mt-5"
          segments={selected.map((stock) => ({
            id: stock.id,
            allocation: draft.allocations[stock.id] ?? 0,
          }))}
        />
      </Card>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={onLaunch} className="sm:flex-1">
          Publish basket
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>
          Back to edit
        </Button>
      </div>
    </div>
  );
}

function LaunchSuccess({
  basket,
  selected,
  onExplore,
}: {
  basket: Basket;
  selected: PreStock[];
  onExplore: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="type-kicker">
        Published
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-4xl">
          Published in this browser
        </h1>
        <StatusBadge label="This browser" />
      </div>
      <p className="mt-3 type-lede">
        {basket.name} is published as a strategy idea on PreLaunch in this
        browser. No token, liquidity, order, or blockchain transaction was
        created.
      </p>

      <Card className="mt-8 p-6">
        <h2 className="font-display text-2xl leading-tight">{basket.name}</h2>
        <p className="mt-2 type-body">
          {basket.category} · {basket.creator} · {selected.length} PreStocks
        </p>
        <p className="mt-4 type-copy">
          {basket.thesis}
        </p>
      </Card>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild>
          <Link to="/basket/$id" params={{ id: basket.id }} search={{ launched: true }}>
            View Basket
          </Link>
        </Button>
        <Button type="button" variant="outline" onClick={onExplore}>
          Explore Baskets
        </Button>
      </div>
    </div>
  );
}
