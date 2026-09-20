import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AMOUNT_PRESETS,
  SCENARIO_PRESETS,
  calculateAllocationStats,
  calculateConstituentImpact,
  calculateScenarioValue,
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

export function StrategySimulator({
  holdings,
  amount,
  scenario,
  onAmount,
  onScenario,
}: {
  holdings: BasketHolding[];
  amount: number;
  scenario: number;
  onAmount: (value: number) => void;
  onScenario: (value: number) => void;
}) {
  const [customText, setCustomText] = useState("");
  const stats = calculateAllocationStats(holdings);
  const total = stats.total > 0 ? stats.total : 100;
  const hypothetical = calculateScenarioValue(amount, scenario);
  const presetMatch = SCENARIO_PRESETS.includes(
    scenario as (typeof SCENARIO_PRESETS)[number],
  );

  const rows = holdings.map((item) => {
    const impact = calculateConstituentImpact(
      amount,
      item.allocation,
      scenario,
      total,
    );
    return { item, impact };
  });

  return (
    <section
      id="simulator"
      className="scroll-mt-[calc(3.75rem+env(safe-area-inset-top,0px))] rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl">What-if</h2>
        <StatusBadge label="Hypothetical simulation" />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <Label htmlFor="sim-amount">Starting amount</Label>
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

          <p className="mt-5 type-kicker">Scenario</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCENARIO_PRESETS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={presetMatch && scenario === value ? "default" : "outline"}
                onClick={() => {
                  setCustomText("");
                  onScenario(value);
                }}
              >
                {value > 0 ? `+${value}%` : `${value}%`}
              </Button>
            ))}
          </div>
          <div className="mt-3">
            <Label htmlFor="sim-custom">Custom scenario</Label>
            <Input
              id="sim-custom"
              value={customText}
              onChange={(event) => {
                const next = event.target.value;
                setCustomText(next);
                const parsed = parseScenarioInput(next);
                if (parsed != null) onScenario(parsed);
              }}
              placeholder="+35%"
              inputMode="decimal"
              className="mt-2 tabular-nums"
              aria-describedby="sim-custom-hint"
            />
            <p id="sim-custom-hint" className="mt-1 type-meta">
              Gain or loss from −90% to +200%.
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-secondary/40 px-4 py-4">
            <p className="type-kicker">Hypothetical value</p>
            <p
              className={cn(
                "mt-1 font-display text-3xl tabular-nums sm:text-4xl",
                scenario > 0 && "text-up",
                scenario < 0 && "text-down",
              )}
            >
              {formatPrice(hypothetical)}
            </p>
            <p className="mt-1 type-meta">
              Hypothetical simulation · {formatPercent(scenario)} on{" "}
              {formatPrice(amount)}
            </p>
          </div>
        </div>

        <div>
          <h3 className="type-card">Constituent impact</h3>
          <div className="mt-3 space-y-3">
            {rows.map(({ item, impact }) => {
              const missing = !item.stock;
              return (
                <div
                  key={item.preStockId}
                  className="rounded-xl border border-border px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate type-card">
                        {item.stock?.name ?? item.preStockId}
                      </p>
                      <p className="mt-1 type-meta">{item.allocation}% allocation</p>
                    </div>
                    <p
                      className={cn(
                        "text-sm font-medium tabular-nums",
                        impact.contribution > 0 && "text-up",
                        impact.contribution < 0 && "text-down",
                      )}
                    >
                      {formatSignedMoney(impact.contribution)} contribution
                    </p>
                  </div>
                  <p className="mt-2 type-meta">
                    {formatPercent(scenario)} scenario · sleeve{" "}
                    {formatPrice(impact.sleeve)} → {formatPrice(impact.scenarioValue)}
                    {missing ? " · Data unavailable for live price" : null}
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
