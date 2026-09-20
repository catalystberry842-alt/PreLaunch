import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BasketCard } from "@/components/basket-card";
import { EmptyState } from "@/components/empty-state";
import { basketsForCreator, getCreator } from "@/lib/creators";
import { decorateBasket, useCommunity } from "@/lib/community";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/creator/$id")({
  component: CreatorPage,
  head: ({ params }) =>
    pageHead(
      getCreator(params.id).name,
      "PreLaunch creator profile — published baskets only.",
    ),
});

function CreatorPage() {
  const { id } = Route.useParams();
  const { ready, tick } = useCommunity();
  const creator = getCreator(id);
  const published = useMemo(() => {
    void ready;
    void tick;
    return basketsForCreator(id).map(decorateBasket);
  }, [id, ready, tick]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="type-kicker">
        Creator
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-4xl">{creator.name}</h1>
      </div>
      <p className="mt-3 max-w-xl type-lede">{creator.bio}</p>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="type-kicker">
            Published baskets
          </p>
          <p className="mt-2 font-display text-2xl tabular-nums">
            {published.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="type-kicker">
            Names used
          </p>
          <p className="mt-2 font-display text-2xl tabular-nums">
            {
              new Set(
                published.flatMap((basket) =>
                  basket.constituents.map((item) => item.preStockId),
                ),
              ).size
            }
          </p>
        </div>
      </div>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="type-kicker">
              Published
            </p>
            <h2 className="mt-2 font-display text-2xl">
              Baskets by {creator.name}
            </h2>
          </div>
          <Link
            to="/discover"
            className="inline-flex min-h-11 items-center type-body hover:text-foreground"
          >
            Explore baskets
          </Link>
        </div>
        <div className="mt-6">
          {published.length === 0 ? (
            <EmptyState
              title="No creator baskets"
              body="This profile has no published books yet."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {published.map((basket) => (
                <BasketCard key={basket.id} basket={basket} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
