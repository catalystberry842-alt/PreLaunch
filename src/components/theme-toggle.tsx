import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const activeTheme = mounted ? theme : null;

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className={cn(
        "inline-flex shrink-0 rounded-lg border border-border bg-card p-0.5",
        className,
      )}
    >
      {(["dark", "light"] as const).map((value) => {
        const active = activeTheme === value;
        const Icon = value === "dark" ? Moon : Sun;
        const label = value === "dark" ? "Dark" : "Light";
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium touch-manipulation transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
              compact ? "min-w-11 sm:min-w-0 sm:px-3" : "flex-1 px-3",
              active
                ? "bg-secondary text-foreground shadow-[var(--shadow-border)]"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className={compact ? "hidden sm:inline" : undefined}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
