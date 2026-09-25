import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AllocationBar } from "@/components/allocation-bar";
import { BasketCard } from "@/components/basket-card";
import { StockAvatar } from "@/components/stock-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { baskets } from "@/lib/baskets";
import { useCatalog } from "@/lib/catalog";
import { resolveConstituents } from "@/lib/prestocks";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => pageHead(),
});

const STEPS = [
  {
    n: "01",
    title: "Discover",
    body: "Browse PreStocks and published baskets",
  },
  {
    n: "02",
    title: "Research",
    body: "Read live catalog data for each PreStock",
  },
  {
    n: "03",
    title: "Build",
    body: "Select PreStocks and define your allocation",
  },
  {
    n: "04",
    title: "Simulate",
    body: "Test hypothetical outcomes without executing a trade",
  },
  {
    n: "05",
    title: "Compare",
    body: "Compare your portfolio with a basket allocation",
  },
];

function Hero() {
  useCatalog();
  const featured = baskets.getFeatured()[0];
  const items = featured ? resolveConstituents(featured.constituents) : [];

  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <div className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 shadow-[var(--shadow-border)]">
            <p className="type-meta font-medium">
              Public PreStocks catalog
            </p>
          </div>
          <h1 className="mt-6 max-w-xl font-display text-4xl leading-tight sm:text-5xl lg:text-6xl">
            Track your PreStocks and build a strategy.
          </h1>
          <p className="mt-5 max-w-lg type-lede">
            PreLaunch gives you one place to track your PreStocks portfolio,
            research private-market exposure, build curated baskets, and
            simulate what-if scenarios.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/portfolio">Track Portfolio</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/discover">
                Explore PreStocks
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 type-meta">
            <Link
              to="/portfolio"
              className="inline-flex min-h-11 items-center text-foreground/80 hover:text-foreground"
            >
              Track Portfolio
            </Link>
            <Link
              to="/discover"
              search={{ tab: "prestocks" }}
              className="inline-flex min-h-11 items-center text-foreground/80 hover:text-foreground"
            >
              Research PreStocks
            </Link>
            <Link
              to="/create"
              className="inline-flex min-h-11 items-center text-foreground/80 hover:text-foreground"
            >
              Build Baskets
            </Link>
            <Link
              to="/simulator"
              className="inline-flex min-h-11 items-center text-foreground/80 hover:text-foreground"
            >
              Simulate Strategies
            </Link>
            <Link
              to="/compare"
              className="inline-flex min-h-11 items-center text-foreground/80 hover:text-foreground"
            >
              Compare
            </Link>
          </p>
        </div>
        {featured ? (
          <Card className="p-6">
            <p className="type-kicker">
                Basket preview
              </p>
            <h2 className="mt-4 font-display text-3xl leading-tight">
              {featured.name}
            </h2>
            <p className="mt-2 type-body">
              {featured.category} · {items.length} PreStocks
            </p>
            <div className="mt-6 space-y-3">
              {items.map((item) => (
                <div
                  key={item.preStockId}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <StockAvatar
                      initials={item.stock.initials}
                      name={item.stock.name}
                      image={item.stock.image}
                      size="sm"
                    />
                    <span className="type-card">{item.stock.name}</span>
                  </div>
                  <span className="tabular-nums type-body">
                    {item.allocation}%
                  </span>
                </div>
              ))}
            </div>
            <AllocationBar
              className="mt-6 h-2.5"
              segments={items.map((item) => ({
                id: item.preStockId,
                allocation: item.allocation,
              }))}
            />
          </Card>
        ) : null}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="type-kicker">
          How it works
        </p>
        <h2 className="mt-3 font-display text-3xl sm:text-4xl">
          Discover, research, simulate
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-border)]"
            >
              <p className="font-mono type-meta">{step.n}</p>
              <h3 className="mt-4 font-display text-base">
                {step.title}
              </h3>
              <p className="mt-2 type-body">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="type-kicker">Product</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Link
            to="/discover"
            search={{ tab: "prestocks" }}
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-border)] touch-manipulation hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <h2 className="font-display text-base">Research</h2>
            <p className="mt-2 type-body">Understand individual PreStocks</p>
          </Link>
          <Link
            to="/portfolio"
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-border)] touch-manipulation hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <h2 className="font-display text-base">Portfolio</h2>
            <p className="mt-2 type-body">Track your holdings and performance</p>
          </Link>
          <Link
            to="/create"
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-border)] touch-manipulation hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <h2 className="font-display text-base">Baskets</h2>
            <p className="mt-2 type-body">Build structured PreStock strategies</p>
          </Link>
          <Link
            to="/simulator"
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-border)] touch-manipulation hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <h2 className="font-display text-base">Simulation</h2>
            <p className="mt-2 type-body">Test hypothetical scenarios</p>
          </Link>
          <Link
            to="/compare"
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-border)] touch-manipulation hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <h2 className="font-display text-base">Comparison</h2>
            <p className="mt-2 type-body">Compare your portfolio with a strategy</p>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Home() {
  useCatalog();
  const featured = baskets.getFeatured();

  return (
    <>
      <Hero />
      <Capabilities />
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="type-kicker">
                Featured baskets
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl">
                Explore the ideas being built
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/discover">View all</Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {featured.map((basket) => (
              <BasketCard key={basket.id} basket={basket} variant="featured" />
            ))}
          </div>
        </div>
      </section>
      <HowItWorks />
      <section>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-border bg-card px-6 py-10 shadow-[var(--shadow-border)] sm:px-10">
            <h2 className="font-display text-3xl sm:text-4xl">
              Publish a basket to PreLaunch
            </h2>
            <p className="mt-3 max-w-lg type-lede">
              Pick PreStocks, set weights, write a thesis, and publish the
              strategy idea in this browser. Publishing never creates a token,
              liquidity, an order, or a blockchain transaction.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link to="/create">Create a Basket</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/discover">Explore Baskets</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
