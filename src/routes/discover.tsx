import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Bot,
  Briefcase,
  Building2,
  Cpu,
  Landmark,
  Rocket,
  Search,
  Shield,
  ShoppingBag,
} from "lucide-react";
import { AllocationBar } from "@/components/allocation-bar";
import { BasketCard } from "@/components/basket-card";
import { CatalogInlineError } from "@/components/catalog-state";
import {
  BasketCardSkeleton,
  NewLaunchRowSkeleton,
  PreStockCardSkeleton,
  SearchHitSkeleton,
} from "@/components/discover-skeletons";
import { EmptyState } from "@/components/empty-state";
import { PreStockCard } from "@/components/prestock-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { baskets } from "@/lib/baskets";
import { useCatalog } from "@/lib/catalog";
import { decorateBasket, useCommunity } from "@/lib/community";
import { creatorIdFromName } from "@/lib/creators";
import {
  DISCOVER_THEMES,
  constituentSearchExtra,
  filterBaskets,
  getFeaturedBaskets,
  getNewestBaskets,
  searchBaskets,
} from "@/lib/discovery";
import { formatDate } from "@/lib/format";
import { prestocks, resolveConstituents, searchPreStocks } from "@/lib/prestocks";
import {
  CATEGORIES,
  type Basket,
  type BasketSort,
  type Category,
  type ConstituentCountFilter,
  type DiscoverTab,
  type FilterCategory,
  type PreStock,
} from "@/lib/types";
import { pageHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

type DiscoverSearch = {
  tab?: DiscoverTab;
  q?: string;
  category?: Category;
  sort?: BasketSort;
  names?: ConstituentCountFilter;
};

export const Route = createFileRoute("/discover")({
  validateSearch: (search: Record<string, unknown>): DiscoverSearch => ({
    tab: isTab(search.tab) ? search.tab : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
    category: isCategory(search.category) ? search.category : undefined,
    sort: isSort(search.sort) ? search.sort : undefined,
    names: isNames(search.names) ? search.names : undefined,
  }),
  component: DiscoverPage,
  head: () =>
    pageHead(
      "Discover",
      "Discover curated PreStock baskets and the live PreStocks catalog they are built from.",
    ),
});

function isTab(value: unknown): value is DiscoverTab {
  return (
    value === "all" ||
    value === "baskets" ||
    value === "prestocks" ||
    value === "saved"
  );
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

function isSort(value: unknown): value is BasketSort {
  return value === "newest" || value === "views" || value === "saves" || value === "name";
}

function isNames(value: unknown): value is ConstituentCountFilter {
  return value === "any" || value === "2" || value === "3" || value === "4plus";
}

const FILTERS: FilterCategory[] = ["All", ...CATEGORIES];

const NAME_FILTERS: { id: ConstituentCountFilter; label: string }[] = [
  { id: "any", label: "Any size" },
  { id: "2", label: "2 names" },
  { id: "3", label: "3 names" },
  { id: "4plus", label: "4+ names" },
];

const BASKET_SORTS: { id: BasketSort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "name", label: "A–Z" },
];

const THEME_ICONS = {
  AI: Cpu,
  Defense: Shield,
  Robotics: Bot,
  Fintech: Landmark,
  Space: Rocket,
  Infrastructure: Building2,
  Consumer: ShoppingBag,
  "Private Markets": Briefcase,
} as const;

type SearchHit =
  | { kind: "BASKET"; key: string; basket: Basket }
  | { kind: "PRESTOCK"; key: string; stock: PreStock };

function DiscoverPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { stocks, stocksError, pending, retry } = useCatalog();
  const { ready, tick } = useCommunity();
  const [query, setQuery] = useState(search.q ?? "");

  const category: FilterCategory = search.category ?? "All";
  const basketSort: BasketSort = search.sort ?? "newest";
  const names: ConstituentCountFilter = search.names ?? "any";
  const searching = query.trim().length > 0;
  const browsing = !searching && category === "All" && names === "any";

  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

  useEffect(() => {
    const next = query.trim() || undefined;
    const current = search.q || undefined;
    if (next === current) return;
    const handle = window.setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: next }),
        replace: true,
      });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, search.q, navigate]);

  useEffect(() => {
    if (search.tab !== "prestocks") return;
    document.getElementById("prestocks")?.scrollIntoView({ block: "start" });
  }, [search.tab]);

  function patchSearch(next: {
    tab?: DiscoverTab;
    q?: string;
    category?: FilterCategory;
    sort?: BasketSort;
    names?: ConstituentCountFilter;
  }) {
    void navigate({
      search: (prev) => {
        const categoryValue: FilterCategory | undefined =
          "category" in next ? next.category : prev.category;
        const sortValue = "sort" in next ? next.sort : prev.sort;
        const namesValue = "names" in next ? next.names : prev.names;
        const qValue = "q" in next ? next.q : prev.q;
        const tabValue = "tab" in next ? next.tab : prev.tab;
        return {
          tab: tabValue,
          q: qValue || undefined,
          category:
            categoryValue && categoryValue !== "All" ? categoryValue : undefined,
          sort: sortValue && sortValue !== "newest" ? sortValue : undefined,
          names: namesValue && namesValue !== "any" ? namesValue : undefined,
        };
      },
      replace: true,
    });
  }

  function clearFilters() {
    setQuery("");
    patchSearch({
      q: undefined,
      category: undefined,
      sort: undefined,
      names: undefined,
    });
  }

  const allBaskets = useMemo(() => {
    void ready;
    void tick;
    return baskets.getAll().map(decorateBasket);
  }, [ready, tick]);

  const extraFor = useMemo(
    () => (basket: Basket) =>
      constituentSearchExtra(
        basket,
        (id) => prestocks.getById(id) ?? stocks.find((item) => item.id === id),
      ),
    [stocks],
  );

  const matchedBaskets = useMemo(
    () => searchBaskets(allBaskets, query, extraFor),
    [allBaskets, query, extraFor],
  );

  const listedBaskets = useMemo(
    () => filterBaskets(matchedBaskets, { category, names, sort: basketSort }),
    [matchedBaskets, category, names, basketSort],
  );

  const featured = useMemo(() => getFeaturedBaskets(allBaskets, 3), [allBaskets]);
  const launched = useMemo(() => getNewestBaskets(allBaskets, 4), [allBaskets]);

  const themeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const basket of allBaskets) {
      counts.set(basket.category, (counts.get(basket.category) ?? 0) + 1);
    }
    return counts;
  }, [allBaskets]);

  const stockResults = useMemo(() => {
    const hits = searchPreStocks(stocks, query);
    if (category === "All") return hits;
    return hits.filter((item) => item.category === category);
  }, [stocks, query, category]);

  const searchHits = useMemo<SearchHit[]>(() => {
    if (!searching) return [];
    return [
      ...listedBaskets.map((basket) => ({
        kind: "BASKET" as const,
        key: `basket-${basket.id}`,
        basket,
      })),
      ...stockResults.map((stock) => ({
        kind: "PRESTOCK" as const,
        key: `prestock-${stock.id}`,
        stock,
      })),
    ];
  }, [searching, listedBaskets, stockResults]);

  const stocksLoading = pending && stocks.length === 0 && !stocksError;
  const emptyCategory = !searching && category !== "All" && listedBaskets.length === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="type-kicker">
        Catalog
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-4xl">Discover</h1>
      </div>
      <div className="mt-5">
        <Button asChild>
          <Link to="/create">Create a Basket</Link>
        </Button>
      </div>

      <div className="relative mt-8">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search baskets, theses, creators, companies, or symbols"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-12 rounded-xl pl-10"
          aria-label="Search baskets and PreStocks"
        />
      </div>

      <div className="mt-4 space-y-3">
        <ChipRow label="Category">
          {FILTERS.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={category === item ? "default" : "outline"}
              className="shrink-0 rounded-full"
              onClick={() =>
                patchSearch({ category: item === "All" ? undefined : item })
              }
            >
              {item}
            </Button>
          ))}
        </ChipRow>
        <ChipRow label="Size">
          {NAME_FILTERS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={names === item.id ? "default" : "outline"}
              className="shrink-0 rounded-full"
              onClick={() =>
                patchSearch({ names: item.id === "any" ? undefined : item.id })
              }
            >
              {item.label}
            </Button>
          ))}
        </ChipRow>
        <ChipRow label="Sort">
          {BASKET_SORTS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={basketSort === item.id ? "default" : "outline"}
              className="shrink-0 rounded-full"
              onClick={() =>
                patchSearch({ sort: item.id === "newest" ? undefined : item.id })
              }
            >
              {item.label}
            </Button>
          ))}
        </ChipRow>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="type-meta">
          Categories and theses are PreLaunch. Prices come from the public
          PreStocks catalog.
        </p>
        {browsing ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {searching ? (
        <Section
          kicker="Results"
          title="Search results"
          count={`${searchHits.length} match${searchHits.length === 1 ? "" : "es"}`}
        >
          {stocksError ? (
            <div className="mb-4">
              <CatalogInlineError message={stocksError} onRetry={retry} />
            </div>
          ) : null}
          {searchHits.length === 0 && !stocksLoading ? (
            <EmptyState
              title="No baskets found"
              body="Try another search or explore all baskets"
              actionLabel="Create a Basket"
              secondaryLabel="Explore all baskets"
              onSecondary={clearFilters}
            />
          ) : (
            <div className="space-y-2">
              {searchHits.map((hit) => (
                <SearchHitRow key={hit.key} hit={hit} />
              ))}
              {stocksLoading
                ? [0, 1, 2].map((item) => <SearchHitSkeleton key={item} />)
                : null}
            </div>
          )}
          {listedBaskets.length > 0 ? (
            <div className="mt-8">
              <CardGrid>
                {listedBaskets.map((basket) => (
                  <BasketCard key={basket.id} basket={basket} />
                ))}
              </CardGrid>
            </div>
          ) : null}
        </Section>
      ) : null}

      {browsing ? (
        <>
          <Section kicker="Featured" title="Featured baskets">
            {featured.length > 0 ? (
              <CardGrid>
                {featured.map((basket) => (
                  <BasketCard key={basket.id} basket={basket} />
                ))}
              </CardGrid>
            ) : allBaskets.length === 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <BasketCardSkeleton key={item} />
                ))}
              </div>
            ) : (
              <p className="type-body">
                No featured baskets in this catalog.
              </p>
            )}
          </Section>

          <Section kicker="New" title="New baskets">
            {launched.length === 0 ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <NewLaunchRowSkeleton key={item} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {launched.map((basket) => (
                  <NewLaunchRow key={basket.id} basket={basket} />
                ))}
              </div>
            )}
          </Section>
        </>
      ) : null}

      {searching ? null : (
        <Section id="themes" kicker="Themes" title="Browse by theme">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {DISCOVER_THEMES.map((item) => {
              const Icon = THEME_ICONS[item];
              const count = themeCounts.get(item) ?? 0;
              const active = category === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    patchSearch({
                      category: active ? undefined : item,
                    })
                  }
                  className={cn(
                    "min-h-24 rounded-2xl border bg-card px-4 py-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-150 touch-manipulation hover:shadow-[var(--shadow-border-hover)]",
                    active ? "border-foreground/40" : "border-border",
                  )}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <p className="mt-3 font-display text-lg leading-tight">{item}</p>
                  <p className="mt-1 type-body">
                    {count === 0
                      ? "No baskets yet"
                      : `${count} basket${count === 1 ? "" : "s"}`}
                  </p>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {searching ? null : (
        <Section
          id="baskets"
          kicker="Baskets"
          title="All baskets"
          count={`${listedBaskets.length} basket${listedBaskets.length === 1 ? "" : "s"}`}
        >
          {listedBaskets.length === 0 ? (
            <EmptyState
              title={
                emptyCategory
                  ? "No baskets in this category yet"
                  : "No baskets found"
              }
              body={
                emptyCategory
                  ? "Be the first to publish a book in this theme."
                  : "Try another search or explore all baskets"
              }
              actionLabel="Create a Basket"
              secondaryLabel={emptyCategory ? undefined : "Explore all baskets"}
              onSecondary={emptyCategory ? undefined : clearFilters}
            />
          ) : (
            <CardGrid>
              {listedBaskets.map((basket) => (
                <BasketCard key={basket.id} basket={basket} />
              ))}
            </CardGrid>
          )}
        </Section>
      )}

      <Section
        id="prestocks"
        kicker="PreStocks"
        title="Building blocks"
        count={
          stocksLoading
            ? "Loading catalog"
            : `${stockResults.length} PreStock${stockResults.length === 1 ? "" : "s"}`
        }
      >
        {stocksError ? (
          <CatalogInlineError message={stocksError} onRetry={retry} />
        ) : stocksLoading ? (
          <CardGrid>
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <PreStockCardSkeleton key={item} />
            ))}
          </CardGrid>
        ) : stockResults.length === 0 ? (
          <p className="type-body">
            {searching
              ? "No PreStocks match this search."
              : "The catalog returned no listings."}
          </p>
        ) : (
          <CardGrid>
            {stockResults.map((stock) => (
              <PreStockCard key={stock.id} stock={stock} />
            ))}
          </CardGrid>
        )}
      </Section>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <p className="w-20 shrink-0 type-kicker">
        {label}
      </p>
      <div className="hide-scrollbar flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto pb-1">
        {children}
      </div>
    </div>
  );
}

function SearchHitRow({ hit }: { hit: SearchHit }) {
  if (hit.kind === "BASKET") {
    const { basket } = hit;
    return (
      <Link
        to="/basket/$id"
        params={{ id: basket.id }}
        className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
      >
        <StatusBadge label="BASKET" />
        <div className="min-w-0 flex-1">
          <p className="truncate type-card">{basket.name}</p>
          <p className="truncate type-body">
            {basket.creator} · {basket.category}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/research/$id"
      params={{ id: hit.stock.id }}
      className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
    >
      <StatusBadge label="PRESTOCK" />
      <div className="min-w-0 flex-1">
        <p className="truncate type-card">{hit.stock.name}</p>
        <p className="truncate type-body">
          {hit.stock.symbol}
        </p>
      </div>
    </Link>
  );
}

function NewLaunchRow({ basket }: { basket: Basket }) {
  const items = resolveConstituents(basket.constituents);
  const creatorId = creatorIdFromName(basket.creator);
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="type-kicker">
            {basket.category}
          </p>
          <Link
            to="/basket/$id"
            params={{ id: basket.id }}
            className="mt-1 inline-block font-display text-xl leading-tight hover:text-foreground"
          >
            {basket.name}
          </Link>
          <p className="mt-1 type-body">
            <Link
              to="/creator/$id"
              params={{ id: creatorId }}
              className="text-foreground/90 hover:text-foreground"
            >
              {basket.creator}
            </Link>
            {" · "}
            {formatDate(basket.createdAt)}
            {" · "}
            {items.length} PreStock{items.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="w-full min-w-0 sm:max-w-xs">
          <AllocationBar
            segments={items.map((item) => ({
              id: item.preStockId,
              allocation: item.allocation,
            }))}
          />
          <p className="mt-2 truncate type-meta">
            {items
              .slice(0, 3)
              .map((item) => item.stock.name)
              .join(" · ")}
            {items.length > 3 ? ` · +${items.length - 3}` : ""}
          </p>
        </div>
      </div>
    </Card>
  );
}

function Section({
  id,
  kicker,
  title,
  count,
  children,
}: {
  id?: string;
  kicker: string;
  title: string;
  count?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="type-kicker">
            {kicker}
          </p>
          <h2 className="mt-2 font-display text-2xl">{title}</h2>
        </div>
        {count ? <p className="max-w-sm text-right type-body">{count}</p> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
