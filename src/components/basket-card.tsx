import { Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { AllocationBar } from "@/components/allocation-bar";
import { StatusBadge } from "@/components/status-badge";
import { StockAvatar } from "@/components/stock-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { creatorIdFromName } from "@/lib/creators";
import { allocationTotal, formatDate } from "@/lib/format";
import { resolveConstituents } from "@/lib/prestocks";
import { isSaved, toggleSave, useCommunity } from "@/lib/community";
import type { Basket } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BasketCard({
  basket,
  variant = "catalog",
}: {
  basket: Basket;
  variant?: "featured" | "catalog";
}) {
  const { ready } = useCommunity();
  const items = resolveConstituents(basket.constituents);
  const total = allocationTotal(items);
  const compact = variant === "catalog";
  const saved = ready && isSaved(basket.id);
  const creatorId = creatorIdFromName(basket.creator);
  const preview = items.slice(0, 3);

  function onSave() {
    const result = toggleSave(basket);
    if (result.error) {
      toast(result.error);
      return;
    }
    toast(result.saved ? "Saved to this browser" : "Removed from Saved");
  }

  return (
    <Card
      className={cn(
        "flex h-full flex-col",
        compact
          ? "p-5 transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
          : "p-6",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="type-kicker">{basket.category}</p>
            {basket.source === "local" ? (
              <StatusBadge label="Published here" />
            ) : null}
          </div>
          <h3
            className={cn(
              "font-display leading-tight",
              compact ? "mt-1 text-xl" : "mt-3 text-2xl",
            )}
          >
            {basket.name}
          </h3>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 type-body">
        {basket.thesis || basket.description}
      </p>

      <p className="mt-4 type-meta">
        <Link
          to="/creator/$id"
          params={{ id: creatorId }}
          className="text-foreground/90 hover:text-foreground"
        >
          {basket.creator}
        </Link>
        {" · "}
        {items.length} PreStock{items.length === 1 ? "" : "s"}
        {" · "}
        {formatDate(basket.createdAt)}
      </p>

      {compact ? null : (
        <div className="mt-4 flex -space-x-1">
          {items.map((item) => (
            <StockAvatar
              key={item.preStockId}
              initials={item.stock.initials}
              name={item.stock.name}
              image={item.stock.image}
              size="sm"
            />
          ))}
        </div>
      )}

      <div className={cn("space-y-1.5", compact ? "mt-4 space-y-2" : "mt-4")}>
        {preview.map((item) => (
          <div
            key={item.preStockId}
            className="flex items-center justify-between gap-3"
          >
            <span className="truncate pr-3 type-card">{item.stock.name}</span>
            <span className="tabular-nums type-meta">{item.allocation}%</span>
          </div>
        ))}
        {items.length > 3 ? (
          <p className="type-meta">
            +{items.length - 3} more · {total}%
          </p>
        ) : (
          <div className="flex items-center justify-between type-meta">
            <span>Total</span>
            <span className="tabular-nums">{total}%</span>
          </div>
        )}
      </div>
      <AllocationBar
        className="mt-4"
        segments={items.map((item) => ({
          id: item.preStockId,
          allocation: item.allocation,
        }))}
      />

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild variant={compact ? "outline" : "default"} className="flex-1">
          <Link to="/basket/$id" params={{ id: basket.id }}>
            View Basket
          </Link>
        </Button>
        <Button
          type="button"
          variant={saved ? "secondary" : "outline"}
          size="icon"
          aria-label={saved ? "Unsave basket" : "Save basket"}
          onClick={onSave}
        >
          {saved ? <BookmarkCheck /> : <Bookmark />}
        </Button>
      </div>
    </Card>
  );
}
