import { cn } from "@/lib/utils";

export function LogoMark({
  className,
  framed = false,
}: {
  className?: string;
  framed?: boolean;
}) {
  const bars = (
    <span
      className={cn(
        "flex size-7 items-end justify-between gap-0.5 px-1 py-1.5",
        !framed && className,
      )}
      aria-hidden="true"
    >
      <span className="h-2 w-1.5 rounded-[1px] bg-foreground/45" />
      <span className="h-3.5 w-1.5 rounded-[1px] bg-foreground/75" />
      <span className="h-full w-1.5 rounded-[1px] bg-foreground" />
    </span>
  );

  if (!framed) return bars;

  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-lg border border-border bg-card shadow-[var(--shadow-border)]",
        className,
      )}
      aria-hidden="true"
    >
      {bars}
    </span>
  );
}
