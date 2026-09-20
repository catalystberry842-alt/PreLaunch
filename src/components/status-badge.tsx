import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({
  label = "PreLaunch",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("normal-case tracking-normal", className)}
    >
      {label}
    </Badge>
  );
}
