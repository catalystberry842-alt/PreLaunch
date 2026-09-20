import { ALLOCATION_COLORS } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AllocationBar({
  segments,
  className,
}: {
  segments: { id: string; allocation: number }[];
  className?: string;
}) {
  return (
    <div
      className={cn("flex h-2 overflow-hidden rounded-full bg-secondary", className)}
      aria-hidden="true"
    >
      {segments.map((segment, index) => (
        <span
          key={segment.id}
          className="h-full"
          style={{
            width: `${segment.allocation}%`,
            backgroundColor: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}
