import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function BasketCardSkeleton() {
  return (
    <Card className="flex h-full flex-col p-5" aria-hidden="true">
      <Bone className="h-3 w-20" />
      <Bone className="mt-3 h-6 w-3/4" />
      <Bone className="mt-4 h-4 w-full" />
      <Bone className="mt-2 h-4 w-5/6" />
      <Bone className="mt-5 h-3 w-40" />
      <div className="mt-4 space-y-2">
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-2/3" />
      </div>
      <Bone className="mt-4 h-2 w-full rounded-full" />
      <Bone className="mt-5 h-11 w-full rounded-lg" />
    </Card>
  );
}

export function PreStockCardSkeleton() {
  return (
    <Card className="flex h-full flex-col p-5" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Bone className="size-10 rounded-full" />
        <div className="flex-1">
          <Bone className="h-4 w-28" />
          <Bone className="mt-2 h-3 w-20" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Bone className="h-10 w-full" />
        <Bone className="h-10 w-full" />
        <Bone className="h-10 w-full" />
        <Bone className="h-10 w-full" />
      </div>
      <Bone className="mt-5 h-11 w-full rounded-lg" />
    </Card>
  );
}

export function SearchHitSkeleton() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
      aria-hidden="true"
    >
      <Bone className="h-5 w-16 rounded-full" />
      <div className="min-w-0 flex-1">
        <Bone className="h-4 w-40" />
        <Bone className="mt-2 h-3 w-28" />
      </div>
    </div>
  );
}

export function NewLaunchRowSkeleton() {
  return (
    <Card className="p-4 sm:p-5" aria-hidden="true">
      <Bone className="h-3 w-16" />
      <Bone className="mt-2 h-5 w-48" />
      <Bone className="mt-3 h-3 w-56" />
      <Bone className="mt-4 h-2 w-full rounded-full" />
    </Card>
  );
}
