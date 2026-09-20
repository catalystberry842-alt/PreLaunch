import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ChangeValue({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const up = value > 0;
  const down = value < 0;
  return (
    <span
      className={cn(
        "tabular-nums",
        up && "text-up",
        down && "text-down",
        !up && !down && "text-muted-foreground",
        className,
      )}
    >
      {formatPercent(value)}
    </span>
  );
}
