import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AMOUNT_PRESETS,
  DEFAULT_SCENARIO_PERCENT,
  SCENARIO_PRESETS,
  calculateHoldingsScenario,
  parseScenarioInput,
} from "@/lib/calculations";
import { formatPercent, formatPrice, formatSignedUsd } from "@/lib/format";
import type { BasketHolding } from "@/lib/types";
import { cn } from "@/lib/utils";

function scenarioFor(map: Record<string, number>, id: string) {
  const value = map[id];
  return Number.isFinite(value) ? value : DEFAULT_SCENARIO_PERCENT;
}

function flatScenario(holdings: BasketHolding[]) {
  const next: Record<string, number> = {};
  for (const item of holdings) next[item.preStockId] = DEFAULT_SCENARIO_PERCENT;
  return next;
}

function toneFor(value: number) {
  return value > 0 ? "text-up" : value < 0 ? "text-down" : undefined;
}

export function StrategySimulator({
  holdings,
  amount,
  onAmount,
  title,
  context,
}: {
  holdings: BasketHolding[];
  amount: number;
  onAmount: (value: number) => void;
  /** What is being simulated, e.g. the basket name. Always shown when set. */
  title?: string;
  /** One-line context under the title, e.g. "Basket · 4 PreStocks". */
  context?: string;
}) {
  const ids = holdings.map((item) => item.preStockId).join("|");
  const [byId, setById] = useState<Record<string, number>>(() => flatScenario(holdings));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [bookKey, setBookKey] = useState(ids);

  // A different basket or portfolio always opens flat at 0%: never inherit
  // moves from the previous book. (Reset during render, not in an effect.)
  if (bookKey !== ids) {
    setBookKey(ids);
    setById(flatScenario(holdings));
    setDrafts({});
  }

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

  if (holdings.length === 0) {
    return (
      <section
        id="simulator"
        aria-labelledby="simulator-heading"
        className="scroll-mt-[calc(3.75rem+env(safe-area-inset-top,0px))] rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center"
      >
        <h2 id="simulator-heading" className="font-display text-2xl">
          Strategy Simulator
        </h2>
        <p className="mt-2 type-body">Select a basket or portfolio to begin a simulation</p>
      </section>
    );
  }

  return (
    <section
      id="simulator"
      aria-labelledby="simulator-heading"
      className="scroll-mt-[calc(3.75rem+env(safe-area-inset-top,0px))] rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="simulator-heading" className="font-display text-2xl">
          Strategy Simulator
        </h2>
        <StatusBadge label="Hypothetical" />
      </div>
      {title ? (
        <div className="mt-3">
          <p className="type-kicker">Simulating</p>
          <p className="mt-1 font-display text-xl sm:text-2xl">{title}</p>
          {context ? <p className="mt-1 type-meta">{context}</p> : null}
        </div>
      ) : null}
      <p className="mt-3 max-w-xl type-body">
        Hypothetical outcomes only. Set a % move per position; nothing is traded, priced, or
        forecast.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Label htmlFor="sim-amount">Starting value</Label>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="group"
            aria-label="Starting value presets"
          >
            {AMOUNT_PRESETS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={amount === value ? "default" : "outline"}
                aria-pressed={amount === value}
                onClick={() => onAmount(value)}
              >
                {formatPrice(value).replace(/\.00$/, "")}
              </Button>
            ))}
          </div>
          <div className="relative mt-3">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 type-body"
            >
              $
            </span>
            <Input
              id="sim-amount"
              type="number"
              min={0}
              step={100}
              value={amount}
              onChange={(event) => onAmount(Math.max(0, Number(event.target.value) || 0))}
              inputMode="decimal"
              className="pl-7 tabular-nums"
            />
          </div>

          <p className="mt-5 type-kicker" id="sim-apply-all">
            Apply one move to all positions
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="sim-apply-all">
            {SCENARIO_PRESETS.map((value) => {
              const active = uniform && firstChange === value;
              return (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  onClick={() => applyAll(value)}
                >
                  {value > 0 ? `+${value}%` : `${value}%`}
                </Button>
              );
            })}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3" aria-live="polite">
            <SummaryStat label="Starting value" value={formatPrice(result.startingValue)} />
            <SummaryStat
              label="Hypothetical value"
              value={formatPrice(result.finalValue)}
              tone={toneFor(result.pnl)}
            />
            <SummaryStat
              label="Hypothetical P&L"
              value={formatSignedUsd(result.pnl)}
              tone={toneFor(result.pnl)}
            />
            <SummaryStat
              label="Hypothetical return"
              value={formatPercent(result.returnPercent)}
              tone={toneFor(result.pnl)}
            />
          </dl>
          <p className="mt-3 type-meta">
            {holdings.length} position{holdings.length === 1 ? "" : "s"} · hypothetical, not a
            forecast
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h3 className="type-card">Positions</h3>
            <p className="type-meta">Hypothetical move per position</p>
          </div>
          <ul className="mt-3 space-y-3">
            {holdings.map((item, index) => {
              const outcome = result.rows[index];
              if (!outcome) return null;
              const id = item.preStockId;
              const change = scenarioFor(byId, id);
              const label = item.stock?.name ?? item.preStockId;
              return (
                <li key={id} className="rounded-xl border border-border px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate type-card">{label}</p>
                      <p className="mt-1 type-meta">
                        {item.stock?.symbol ?? "Not in live catalog"}
                      </p>
                    </div>
                    <div className="w-full sm:w-36 sm:shrink-0">
                      <Label htmlFor={`sim-pos-${id}`} className="whitespace-nowrap type-meta">
                        Hypothetical move
                      </Label>
                      <div className="relative mt-1">
                        <Input
                          id={`sim-pos-${id}`}
                          value={drafts[id] ?? String(change)}
                          onChange={(event) => setOne(id, event.target.value)}
                          placeholder="0"
                          inputMode="decimal"
                          aria-describedby={`sim-pos-${id}-result`}
                          className="pr-8 tabular-nums"
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 type-meta"
                        >
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                  <dl
                    id={`sim-pos-${id}-result`}
                    className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4"
                  >
                    <PositionStat label="Allocation" value={`${item.allocation}%`} />
                    <PositionStat
                      label="Starting value"
                      value={formatPrice(outcome.startingValue)}
                    />
                    <PositionStat
                      label="Resulting value"
                      value={formatPrice(outcome.resultingValue)}
                    />
                    <PositionStat
                      label="P&L"
                      value={formatSignedUsd(outcome.pnl)}
                      tone={toneFor(outcome.pnl)}
                    />
                  </dl>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 px-4 py-4">
      <dt className="type-kicker">{label}</dt>
      <dd className={cn("mt-1 font-display text-xl tabular-nums sm:text-2xl", tone)}>{value}</dd>
    </div>
  );
}

function PositionStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-meta">{label}</dt>
      <dd className={cn("text-sm tabular-nums", tone)}>{value}</dd>
    </div>
  );
}
