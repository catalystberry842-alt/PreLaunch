import { Link } from "@tanstack/react-router";
import { LogoMark } from "@/components/logo-mark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border pb-[max(4.5rem,calc(env(safe-area-inset-bottom)+2rem))] md:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="max-w-xl">
          <div className="flex items-center gap-2.5">
            <LogoMark framed />
            <p className="font-display text-base">PreLaunch</p>
          </div>
          <p className="mt-6 type-meta leading-relaxed">
            PreLaunch publishes curated PreStock baskets in your browser. It is
            not a token launch, brokerage, or offer of securities. PreStocks are
            economic exposure, not ownership of the companies they reference.
            Nothing here is financial advice.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div className="flex flex-col gap-2.5">
            <p className="type-kicker">
              Product
            </p>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center text-foreground/90 touch-manipulation hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 rounded-md"
            >
              Home
            </Link>
            <Link
              to="/discover"
              className="inline-flex min-h-11 items-center text-foreground/90 touch-manipulation hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 rounded-md"
            >
              Discover
            </Link>
            <Link
              to="/portfolio"
              className="inline-flex min-h-11 items-center text-foreground/90 touch-manipulation hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 rounded-md"
            >
              Portfolio
            </Link>
            <Link
              to="/create"
              className="inline-flex min-h-11 items-center text-foreground/90 touch-manipulation hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 rounded-md"
            >
              Create
            </Link>
            <Link
              to="/saved"
              className="inline-flex min-h-11 items-center text-foreground/90 touch-manipulation hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 rounded-md"
            >
              Saved
            </Link>
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="type-kicker">
              Catalog
            </p>
            <Link
              to="/discover"
              search={{ tab: "prestocks" }}
              className="inline-flex min-h-11 items-center text-foreground/90 touch-manipulation hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 rounded-md"
            >
              PreStocks
            </Link>
            <Link
              to="/basket/$id"
              params={{ id: "ai-infrastructure" }}
              className="inline-flex min-h-11 items-center text-foreground/90 touch-manipulation hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 rounded-md"
            >
              AI Infrastructure
            </Link>
            <Link
              to="/basket/$id"
              params={{ id: "future-of-defense" }}
              className="inline-flex min-h-11 items-center text-foreground/90 touch-manipulation hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 rounded-md"
            >
              Future of Defense
            </Link>
            <Link
              to="/basket/$id"
              params={{ id: "next-gen-fintech" }}
              className="inline-flex min-h-11 items-center text-foreground/90 touch-manipulation hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 rounded-md"
            >
              Next-Gen Fintech
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
