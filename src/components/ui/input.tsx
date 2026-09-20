import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground shadow-none transition-[border-color,box-shadow] duration-100 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      onFocus={(event) => {
        if (type === "number") event.currentTarget.select();
        onFocus?.(event);
      }}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
