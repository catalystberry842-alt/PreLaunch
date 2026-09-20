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
    body: "Explore PreStocks and community-created baskets",
  },
  {
    n: "02",
    title: "Research",
    body: "Understand the companies inside each basket",
  },
  {
    n: "03",
    title: "Build",
    body: "Select PreStocks and define your allocation",
  },
  {
    n: "04",
    title: "Publish",
    body: "Save the basket in this browser on PreLaunch",
  },
  {
    n: "05",
    title: "Simulate",
    body: "Apply hypothetical scenarios to a published basket",
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
            Build the next portfolio before the next IPO
          </h1>
          <p className="mt-5 max-w-md type-lede">
            Create, discover, research and simulate curated baskets built from
            PreStocks.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/discover">Explore Baskets</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/create">
                Create a Basket
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="mt-3">
            <Button asChild size="lg" variant="outline">
              <a href="/PreLaunch.zip" download="PreLaunch.zip">
                Download project zip
              </a>
            </Button>
          </div>
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
          Discover, research, launch
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

function Home() {
  useCatalog();
  const featured = baskets.getFeatured();

  return (
    <>
      <Hero />
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
              Pick PreStocks, set weights, write a thesis, and it goes live in
              this browser.
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
