import { useState } from "react";
import { cn } from "@/lib/utils";

const TONES = [
  "bg-secondary",
  "bg-muted",
  "bg-accent",
  "bg-surface-raised",
] as const;

function hashName(name: string) {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const SIZE = {
  sm: "size-8 text-xs",
  md: "size-10 text-xs",
  lg: "size-14 text-lg",
} as const;

export function StockAvatar({
  initials,
  name,
  image,
  size = "md",
}: {
  initials: string;
  name: string;
  image?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const tone = TONES[hashName(name) % TONES.length];
  const frame = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border font-semibold tracking-tight text-foreground",
    SIZE[size],
    tone,
  );

  if (image && !failed) {
    return (
      <span className={frame}>
        <img
          src={image}
          alt=""
          draggable={false}
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={frame}>
      {initials}
    </span>
  );
}
