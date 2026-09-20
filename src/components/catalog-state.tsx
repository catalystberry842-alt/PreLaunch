import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function CatalogLoading() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <p className="font-display text-2xl">Loading PreStocks</p>
      <p className="mt-2 type-body">
        Fetching the public PreStocks catalog.
      </p>
    </div>
  );
}

export function CatalogError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <p className="font-display text-2xl">Unable to load PreStocks</p>
      <p className="mt-2 type-body">{message}</p>
      <Button type="button" variant="outline" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function CatalogInlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="type-body">
        PreStocks catalog unavailable. Basket discovery still works. {message}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function CatalogEmpty({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <p className="font-display text-2xl">No PreStocks available</p>
      <p className="mt-2 type-body">
        The catalog returned no listings.
      </p>
      {onRetry ? (
        <Button type="button" variant="outline" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function NotFoundState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="mt-3 type-lede">{body}</p>
      <Button asChild className="mt-6">
        <Link to="/discover">Back to Discover</Link>
      </Button>
    </div>
  );
}
