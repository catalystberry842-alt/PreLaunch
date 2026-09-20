import { Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/status-badge";
import { StockAvatar } from "@/components/stock-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCompact, formatPrice } from "@/lib/format";
import type { PreStock } from "@/lib/types";

export function PreStockCard({ stock }: { stock: PreStock }) {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <StockAvatar
            initials={stock.initials}
            name={stock.name}
            image={stock.image}
          />
          <div>
            <h3 className="font-display text-lg leading-tight">{stock.name}</h3>
            <p className="type-kicker">
              {stock.symbol} · {stock.category}
            </p>
          </div>
        </div>
        <StatusBadge label="Catalog" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="type-kicker">
            Token price
          </p>
          <p className="mt-1 tabular-nums">{formatPrice(stock.tokenPrice)}</p>
        </div>
        <div>
          <p className="type-kicker">
            Mark price
          </p>
          <p className="mt-1 tabular-nums">{formatPrice(stock.markPrice)}</p>
        </div>
        <div>
          <p className="type-kicker">
            Implied valuation
          </p>
          <p className="mt-1 tabular-nums">
            {formatCompact(stock.impliedValuation)}
          </p>
        </div>
        <div>
          <p className="type-kicker">
            Mark valuation
          </p>
          <p className="mt-1 tabular-nums">
            {formatCompact(stock.markValuation)}
          </p>
        </div>
      </div>
      <p className="mt-4 line-clamp-2 flex-1 type-body">
        {stock.description}
      </p>
      <Button asChild variant="outline" className="mt-5 w-full">
        <Link to="/research/$id" params={{ id: stock.id }}>
          Research
        </Link>
      </Button>
    </Card>
  );
}
