import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/discover" as const, label: "Discover" },
  { to: "/portfolio" as const, label: "Portfolio" },
  { to: "/create" as const, label: "Create" },
  { to: "/saved" as const, label: "Saved" },
];

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

const navClass = (active: boolean) =>
  cn(
    "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors duration-100 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
    active
      ? "bg-secondary text-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-foreground",
  );

export function SiteHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background pt-[env(safe-area-inset-top,0px)] md:bg-background/92 md:backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link
          to="/"
          aria-label="PreLaunch home"
          className="flex min-h-11 items-center gap-2.5 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 rounded-lg"
        >
          <LogoMark framed />
          <span className="font-display text-base">
            PreLaunch
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-1">
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map((item) => {
              const active = isActive(pathname, item.to);
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={navClass(active)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <ThemeToggle compact />
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex items-center gap-2.5">
                <LogoMark framed />
                <p className="font-display text-lg">PreLaunch</p>
              </div>
              <nav className="mt-8 flex flex-col gap-1" aria-label="Primary">
                <SheetClose asChild>
                  <Link
                    to="/"
                    aria-current={pathname === "/" ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center rounded-lg px-3 text-base font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
                      pathname === "/"
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    Home
                  </Link>
                </SheetClose>
                {NAV.map((item) => {
                  const active = isActive(pathname, item.to);
                  return (
                    <SheetClose asChild key={item.label}>
                      <Link
                        to={item.to}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 items-center rounded-lg px-3 text-base font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
                          active
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.label}
                      </Link>
                    </SheetClose>
                  );
                })}
              </nav>
              <div className="mt-8">
                <p className="type-kicker">Appearance</p>
                <ThemeToggle className="mt-3 w-full" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
