import { useEffect, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { ALLOCATION_COLORS } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AllocationDonut({
  segments,
  className,
}: {
  segments: { id: string; name: string; allocation: number }[];
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const data = segments
    .filter((segment) => segment.allocation > 0)
    .map((segment) => ({
      id: segment.id,
      name: segment.name,
      value: segment.allocation,
    }));

  return (
    <div className={cn("flex flex-col items-center gap-5 sm:flex-row sm:items-start", className)}>
      <div className="size-40 shrink-0 pointer-events-none">
        {!mounted || data.length === 0 ? (
          <div className="flex size-40 items-center justify-center">
            <div className="size-32 rounded-full border border-dashed border-border" />
          </div>
        ) : (
          <PieChart width={160} height={160}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx={80}
              cy={80}
              innerRadius={48}
              outerRadius={72}
              paddingAngle={1.5}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.id}
                  fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {segments.length === 0 ? (
          <p className="type-body">
            Select PreStocks to see the allocation mix.
          </p>
        ) : (
          segments.map((segment, index) => (
            <div
              key={segment.id}
              className="flex items-center justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
                  }}
                />
                <span className="truncate type-card">{segment.name}</span>
              </span>
              <span className="tabular-nums type-meta">
                {segment.allocation}%
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
