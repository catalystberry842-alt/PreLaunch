import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AMOUNT_PRESETS,
  SCENARIO_PRESETS,
  calculateAllocationStats,
  calculateHoldingsScenario,
  parseScenarioInput,
} from "@/lib/calculations";
import { formatPercent, formatPrice } from "@/lib/format";
import type { BasketHolding } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatSignedMoney(value: number) {
  const body = formatPrice(Math.abs(value));
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

function scenarioFor(map: Record<string, number>, id: string) {
  const value = map[id];
  return Number.isFinite(value) ? value : 0;
}

function zeroMap(holdings: BasketHolding[]) {
  const next: Record<string, number> = {};
  for (const item of holdings) next[item.preStockId] = 0;
  return next;
}

export function StrategySimulator({
  holdings,
  amount,
  onAmount,
  onScenario,
  basketName,
}: {
  holdings: BasketHolding[];
  amount: number;
  scenario?: number;
  onAmount: (value: number) => void;
  onScenario?: (value: number) => void;
  basketName?: string;
}) {
  const ids = holdings.map((item) => item.preStockId).join("|");
  const [byId, setById] = useState<Record<string, number>>(() => zeroMap(holdings));
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setById(zeroMap(holdings));
    setDrafts({});
    // Always open a book at 0%. Do not inherit a parent scenario or a previous basket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const stats = calculateAllocationStats(holdings);
  const result = useMemo(
    () =>
      calculateHoldingsScenario(
        amount,
        holdings.map((item) => ({
          allocation: item.allocation,
          scenarioPercent: scenarioFor(byId, item.preStockId),
        })),
      ),
    [amount, holdings, byId],
  );

  function applyAll(value: number) {
    const next: Record<string, number> = {};
    for (const item of holdings) next[item.preStockId] = value;
    setById(next);
    setDrafts({});
    onScenario?.(value);
  }

  function setOne(id: string, raw: string) {
    setDrafts((current) => ({ ...current, [id]: raw }));
    const parsed = parseScenarioInput(raw);
    if (parsed == null) return;
    setById((current) => ({ ...current, [id]: parsed }));
  }

  const firstChange = holdings[0] ? scenarioFor(byId, holdings[0].preStockId) : 0;
  const uniform =
    holdings.length > 0 &&
    holdings.every((item) => scenarioFor(byId, item.preStockId) === firstChange);
  const presetMatch = SCENARIO_PRESETS.includes(
    firstChange as (typeof SCENARIO_PRESETS)[number],
  );

  if (holdings.length === 0) {
    return (
      <section
        id="simulator"
        className="scroll-mt-[calc(3.75rem+env(safe-area-inset-top,0px))] rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center"
      >
        <h2 className="font-display text-2xl">Strategy Simulator</h2>
        <p className="mt-2 type-body">
          Select a basket or portfolio to begin a simulation
        </p>
      </section>
    );
  }

  return (
    <section
      id="simulator"
      className="scroll-mt-[calc(3.75rem+env(safe-area-inset-top,0px))] rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      {basketName ? (
        <div className="mb-4">
          <p className="font-display text-2xl sm:text-3xl">{basketName}</p>
          <p className="mt-1 type-meta">Simulating this basket</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl">Strategy Simulator</h2>
        <StatusBadge label="Hypothetical" />
      </div>
      <p className="mt-2 max-w-xl type-body">
        Test hypothetical outcomes for a PreStock basket or portfolio without
        executing a trade.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Label htmlFor="sim-amount">Starting capital</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {AMOUNT_PRESETS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={amount === value ? "default" : "outline"}
                onClick={() => onAmount(value)}
              >
                {formatPrice(value).replace(/\.00$/, "")}
              </Button>
            ))}
          </div>
          <div className="relative mt-3">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 type-body">
              $
            </span>
            <Input
              id="sim-amount"
              type="number"
              min={0}
              step={100}
              value={amount}
              onChange={(event) =>
                onAmount(Math.max(0, Number(event.target.value) || 0))
              }
              inputMode="decimal"
              className="pl-7 tabular-nums"
            />
          </div>

          <p className="mt-5 type-kicker">Apply to all positions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCENARIO_PRESETS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={uniform && presetMatch && firstChange === value ? "default" : "outline"}
                onClick={() => applyAll(value)}
              >
                {value > 0 ? `+${value}%` : `${value}%`}
              </Button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-4">
              <p className="type-kicker">Hypothetical value</p>
              <p
                className={cn(
                  "mt-1 font-display text-2xl tabular-nums sm:text-3xl",
                  result.pnl > 0 && "text-up",
                  result.pnl < 0 && "text-down",
                )}
              >
                {formatPrice(result.scenarioValue)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-4">
              <p className="type-kicker">Hypothetical P&L</p>
              <p
                className={cn(
                  "mt-1 font-display text-2xl tabular-nums sm:text-3xl",
                  result.pnl > 0 && "text-up",
                  result.pnl < 0 && "text-down",
                )}
              >
                {formatSignedMoney(result.pnl)}
              </p>
              <p className="mt-1 type-meta">
                Hypothetical return {formatPercent(result.returnPercent)}
              </p>
            </div>
          </div>
          <p className="mt-3 type-meta">
            Starting {formatPrice(amount)} · {stats.count} position
            {stats.count === 1 ? "" : "s"} · not a forecast
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 className="type-card">Positions</h3>
            <p className="type-meta">Hypothetical % change</p>
          </div>
          <div className="mt-3 space-y-3">
            {holdings.map((item, index) => {
              const impact = result.rows[index];
              if (!impact) return null;
              const id = item.preStockId;
              const change = scenarioFor(byId, id);
              return (
                <div key={id} className="rounded-xl border border-border px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate type-card">
                        {item.stock?.name ?? item.preStockId}
                      </p>
                      <p className="mt-1 type-meta">
                        {item.allocation}% allocation · {formatPrice(impact.sleeve)}{" "}
                        starting value
                      </p>
                    </div>
                    <div className="relative w-full sm:w-32">
                      <Label htmlFor={`sim-pos-${id}`} className="sr-only">
                        Hypothetical change for {item.stock?.symbol ?? item.preStockId}
                      </Label>
                      <Input
                        id={`sim-pos-${id}`}
                        value={drafts[id] ?? (change === 0 ? "0" : String(change))}
                        onChange={(event) => setOne(id, event.target.value)}
                        placeholder="0"
                        inputMode="decimal"
                        className="pr-8 tabular-nums"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 type-meta">
                        %
                      </span>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "mt-2 type-meta",
                      impact.contribution > 0 && "text-up",
                      impact.contribution < 0 && "text-down",
                    )}
                  >
                    {formatPercent(change)} · {formatPrice(impact.sleeve)} →{" "}
                    {formatPrice(impact.scenarioValue)} ·{" "}
                    {formatSignedMoney(impact.contribution)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
