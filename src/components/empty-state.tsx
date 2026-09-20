import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  body,
  actionLabel = "Create a Basket",
  actionTo = "/create",
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: "/create" | "/discover" | "/";
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <p className="font-display text-2xl">{title}</p>
      <p className="mt-2 type-body">{body}</p>
      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild>
          <Link to={actionTo}>{actionLabel}</Link>
        </Button>
        {secondaryLabel && onSecondary ? (
          <Button type="button" variant="outline" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
