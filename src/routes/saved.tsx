import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BasketCard } from "@/components/basket-card";
import { BasketCardSkeleton } from "@/components/discover-skeletons";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { baskets } from "@/lib/baskets";
import { savedIds, sortBaskets, useCommunity } from "@/lib/community";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/saved")({
  component: SavedPage,
  head: () =>
    pageHead(
      "Saved",
      "Baskets you save stay in this browser. This is not an account.",
    ),
});

function SavedPage() {
  const { ready, tick } = useCommunity();
  const saved = useMemo(() => {
    void tick;
    if (!ready) return [];
    const ids = new Set(savedIds());
    const published = baskets.getUserBaskets();
    const bookmarked = baskets.getAll().filter((item) => ids.has(item.id));
    const merged = new Map<string, (typeof published)[number]>();
    for (const item of [...published, ...bookmarked]) {
      merged.set(item.id, item);
    }
    return sortBaskets([...merged.values()], "newest");
  }, [ready, tick]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="type-kicker">
        Your library
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-4xl">Saved</h1>
        <StatusBadge label="This browser" />
      </div>
      <div className="mt-10">
        {!ready ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            <BasketCardSkeleton />
            <BasketCardSkeleton />
            <BasketCardSkeleton />
          </div>
        ) : saved.length === 0 ? (
          <EmptyState
            title="No saved baskets"
            body="Publish a basket or open one and tap Save Basket. Your list lives in this browser."
            actionLabel="Explore Baskets"
            actionTo="/discover"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((basket) => (
              <BasketCard key={basket.id} basket={basket} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
