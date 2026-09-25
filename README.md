# PreLaunch

**A read-only portfolio and strategy layer for [PreStocks](https://prestocks.com)** — tokenized, pre-IPO economic exposure on Solana.

PreLaunch lets you discover and research PreStocks, track the PreStocks held by any Solana wallet, see value / allocation / cost basis where on-chain history supports it, build allocation-based PreStock baskets, compare a wallet against a basket, and run explicitly hypothetical what-if scenarios.

> **Read-only by design.** PreLaunch never connects a wallet, never asks for a private key or seed phrase, never signs or sends a transaction, and has no trading, swap, order, or custody functionality. Publishing a basket publishes a _strategy idea inside PreLaunch_ — it does not create a token, liquidity, an order, or a blockchain transaction.

Demo: https://prelaunched.grok.me/

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Stack](#stack)
- [Portfolio data flow](#portfolio-data-flow)
- [PreStocks API](#prestocks-api)
- [Helius integration and Solana RPC fallback](#helius-integration-and-solana-rpc-fallback)
- [Asset matching](#asset-matching)
- [Cost-basis methodology](#cost-basis-methodology)
- [Baskets](#baskets)
- [Portfolio vs basket comparison](#portfolio-vs-basket-comparison)
- [Strategy simulator](#strategy-simulator)
- [Security model](#security-model)
- [Limitations](#limitations)
- [Local development](#local-development)
- [Testing and CI](#testing-and-ci)
- [Hosting (grok.me)](#hosting-grokme)
- [Repository structure](#repository-structure)

Deeper docs: [`docs/architecture.md`](docs/architecture.md) · [`docs/data-model.md`](docs/data-model.md) · [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`SECURITY.md`](SECURITY.md)

---

## Features

| Area             | Route                        | What it does                                                                                                                                                                         |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Discover         | `/discover`                  | Browse the live PreStocks catalog and baskets; search by name, symbol, thesis, creator; filter by category and constituent count.                                                    |
| Research         | `/research/$id`              | Catalog fields for one PreStock: token price, mark price, token-vs-mark spread, supply, implied and mark valuation, link to the PreStocks page, related baskets.                     |
| Portfolio        | `/portfolio?wallet=…`        | Holdings, quantity, current price, value, allocation, average-cost basis, unrealized and realized P&L — each shown only when the data supports it, otherwise labelled _Unavailable_. |
| Create / publish | `/create`                    | Select ≥ 2 PreStocks, set allocations that total 100%, write a thesis, publish to this browser.                                                                                      |
| Basket           | `/basket/$id`                | Thesis, allocation breakdown, catalog data per constituent, embedded simulator.                                                                                                      |
| Compare          | `/compare?wallet=…&basket=…` | Wallet weights vs a basket's reference weights: overlap, portfolio-only, basket-only, signed difference.                                                                             |
| Simulator        | `/simulator`                 | Per-position hypothetical % moves on a basket or on a wallet's current weights.                                                                                                      |
| Saved / creators | `/saved`, `/creator/$id`     | Baskets saved in this browser; baskets grouped by creator name.                                                                                                                      |
| JSON API         | `GET /api/portfolio/$wallet` | The same portfolio snapshot as JSON (`Cache-Control: no-store`).                                                                                                                     |

## Architecture

PreLaunch is a single [TanStack Start](https://tanstack.com/start) app (React 19, SSR) deployed as a Vercel function via Nitro.

```
Browser (React)                         Server (TanStack Start / Nitro)                 External
─────────────────                       ────────────────────────────────                ────────
routes/* ──useCatalog()──▶ root loader ─▶ getPreStocksFn ─▶ prestocks-api.ts ───────────▶ prestocks.com/api/prestocks
routes/portfolio ─────────▶ getPortfolioFn (POST) ─▶ portfolio-load.server.ts
                                              │   ├─ fetchPreStocks()     (catalog, 60 s cache)
                                              │   ├─ helius.server.ts     ─ Helius DAS / Enhanced Tx ─▶ mainnet.helius-rpc.com
                                              │   │    └─ fallback ─▶ solana-rpc.server.ts ──────────▶ public Solana RPC
                                              │   ├─ helius-history.ts    (parse tx → PreStock movements)
                                              │   └─ portfolio.ts + cost-basis.ts (pure snapshot + average cost)
                                              ▼
                                         PortfolioResponse
localStorage: baskets, drafts, saves, local view counts   (no server-side user data)
```

Key properties:

- **Server-only secrets.** Everything touching `HELIUS_API_KEY` lives in `*.server.ts` modules that throw if imported in a browser and are loaded with dynamic `import()` from server functions.
- **Pure core.** Matching, cost basis, comparison, allocation validation and simulation are pure functions in `src/lib/` with unit tests; the routes are presentation.
- **No server-side persistence of PreLaunch data.** Baskets, drafts and saves are stored in `localStorage`; the portfolio snapshot is cached in `sessionStorage` for the simulator/compare pages.

See [`docs/architecture.md`](docs/architecture.md) for module-level detail.

## Stack

- React 19, TanStack Start / Router, TypeScript (strict)
- Tailwind CSS v4, Radix UI primitives, lucide icons, Recharts (allocation donut only)
- Nitro (Vercel preset) for the server bundle; Grok app-builder hosting wiring for [grok.me](#hosting-grokme)
- PreStocks public catalog API
- Optional [Helius](https://www.helius.dev/) (DAS + Enhanced Transactions), public Solana JSON-RPC fallback
- Tests: Node's built-in test runner with `--experimental-strip-types` (no extra test framework)
- ESLint 9 (typescript-eslint, react-hooks), Prettier

## Portfolio data flow

`loadPortfolio(wallet)` in `src/lib/portfolio-load.server.ts`:

1. **Validate** the address: base58, decodes to exactly 32 bytes (`src/lib/solana-address.ts`). Invalid input returns `INVALID_WALLET` without any network call.
2. **Catalog**: `fetchPreStocks()` (60 s in-memory cache). Failure → `PRESTOCKS_REQUEST_FAILED`; nothing is guessed.
3. **Balances**: `fetchWalletFungibles(wallet, { mints })` — Helius first when configured, otherwise public RPC (see below). 30 s per-wallet cache.
4. **History**: `fetchWalletHistory(wallet)` → `parsePreStockTransactions()`. History failure does _not_ fail the request; it sets `historyStatus: "unavailable"` so holdings still render while cost basis is shown as unavailable.
5. **Snapshot**: `buildPortfolioSnapshot()` (pure) matches balances to the catalog by mint, prices them, computes allocation, runs average cost, and assembles totals.

Every derived number is either computed from real inputs or `null`:

| Field           | Source                                   | `null` / partial when                                             |
| --------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| `quantity`      | on-chain token amount (decimals applied) | —                                                                 |
| `tokenPrice`    | catalog `tokenPrice`                     | catalog price missing, non-finite or ≤ 0                          |
| `value`         | `quantity × tokenPrice`                  | price unavailable                                                 |
| `allocation`    | `value ÷ Σ priced values`                | price unavailable                                                 |
| `totalValue`    | Σ priced values                          | `unpricedCount > 0` → UI labels the total _Partial_               |
| `costBasis`     | average cost of verified acquisitions    | history missing, truncated, or includes unknown-cost tokens       |
| `unrealizedPnl` | `value − costBasis`                      | either side unavailable                                           |
| `realizedPnl`   | sales matched to average cost            | any sale lacks proceeds or fully-known cost; history not complete |

The UI (`src/routes/portfolio.tsx`) renders `null` as **Unavailable**, marks totals with unpriced holdings as **Partial**, and adds a short status label under each summary figure (e.g. "1 of 2 verified", "No sales", "Missing prices") from the pure `summaryNotes()` helper.

## PreStocks API

- Endpoint: `GET https://prestocks.com/api/prestocks` (public, JSON array).
- Consumed fields: `name`, `symbol`, `description`, `image`, `external_url`, `contract_address`, `tokenPrice`, `markPrice`, `markValuation`, `impliedValuation`, `supply`.
- `normalizePreStock()` upper-cases the symbol (used as the internal id), derives a display name, and assigns a PreLaunch-only category from a static symbol map (`src/lib/prestock-meta.ts`) because the API has no categories.
- Rows without a string `name` and `symbol` are dropped; an empty or non-array response is an error.
- PreLaunch shows only what the catalog returns — no additional or unrelated assets.

## Helius integration and Solana RPC fallback

`src/lib/helius.server.ts` (server-only):

| Step     | With `HELIUS_API_KEY`                                                                                                                                     | Without it / on Helius failure                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Balances | DAS `getAssetsByOwner` (fungibles, paged, ≤ 5 × 1000), falling back to `searchAssets` (`tokenType: fungible`)                                             | `getTokenAccountsByOwner` for the Token-2022 program on public RPC, filtered to catalog mints                                        |
| History  | Enhanced Transactions `GET /v0/addresses/{wallet}/transactions` (≤ 6 pages × 100, `token-accounts=balanceChanged`); on 404 retries the `api-mainnet` host | `getSignaturesForAddress` (last 40) + `getTransaction` (jsonParsed), converted to the enhanced shape by `fromParsedRpcTransaction()` |

Public RPC (`src/lib/solana-rpc.server.ts`) rotates between `api.mainnet-beta.solana.com` and `solana-rpc.publicnode.com`, uses a 12 s timeout, and retries rate-limited responses up to 3 times with linear back-off. Helius auth errors (401/403) surface as `HELIUS_AUTH_ERROR`; any `api-key=` fragment in upstream error text is redacted before it can reach a response.

History is marked **partial** when the page/signature limit is hit, so cost basis is never reported as complete on a truncated history.

## Asset matching

Wallet tokens are matched to PreStocks **only by exact mint / `contract_address`** (`matchPreStockHoldings`, `parsePreStockTransactions`):

- Addresses are trimmed but never case-folded (base58 is case-sensitive).
- Names, symbols and tickers are never used to match on-chain assets.
- Multiple token accounts of the same mint are summed.
- Tokens whose mint is not in the catalog are ignored.

## Cost-basis methodology

Method: **average cost** (`src/lib/cost-basis.ts`), per mint, processed chronologically.

Transaction classification (`src/lib/helius-history.ts`):

- **Buy / Acquisition** — a swap where exactly one PreStock comes in and USDC/USDT (the only assets valued, at $1) goes out. Cost = stablecoins paid.
- **Sell / Disposal** — a swap where exactly one PreStock goes out and USDC/USDT comes in. Proceeds = stablecoins received.
- **Transfer in / out** — everything else, including swaps against non-stable assets and multi-PreStock swaps (USD cannot be attributed honestly).

Accounting rules:

- Only priced acquisitions enter the average. **Incoming transfers are not buys**; they add _unknown-cost_ quantity.
- **Outgoing transfers are not sales**; they reduce quantity (unknown-cost first) and realize nothing.
- A sale realizes P&L only if proceeds are known _and_ the sold quantity is fully covered by known-cost inventory. Otherwise realized P&L becomes unavailable.
- A position's cost basis is reported only when known-cost quantity matches the current on-chain quantity (tolerance 1e-6 relative) with no unknown-cost tokens.
- Portfolio totals require every holding to be covered and history status `ok`.
- **The current catalog price is never used as a historical purchase price.**

## Baskets

- Model: `Basket { id, name, category, creator, source: "catalog" | "local", constituents: { preStockId, allocation }[], thesis, … }` — see [`docs/data-model.md`](docs/data-model.md).
- Seed strategies live in `src/data/mock-baskets.ts` (source `catalog`; example creator handles; metrics start at 0).
- User baskets are created in `/create`, validated by `validateAllocations()` (`src/lib/basket-validation.ts`), and saved to `localStorage` (`prelaunch.baskets.v1`) by `baskets.publish()`.
- Allocation rules: ≥ 2 PreStocks; no empty or duplicate ids (after alias canonicalization); every allocation finite and > 0; total within **±0.05** of 100% (absorbs float noise like 33.3 + 33.3 + 33.4).
- **Publishing publishes a strategy idea inside PreLaunch only.** It creates no token, liquidity, order, or blockchain transaction.
- Views and saves are counted locally in this browser; they are not network-wide statistics.
- Share links work for catalog baskets. Browser-published baskets exist only in the publishing browser, so the share button explains that instead of producing a dead link.

## Portfolio vs basket comparison

`comparePortfolioToBasket()` (`src/lib/compare.ts`):

- Portfolio weight = position value ÷ total priced value; basket weight = constituent allocation.
- Rows are classified `both`, `portfolio` (held, not in basket) or `basket` (in basket, not held); `difference = portfolio% − basket%`.
- Plain-language insights restate those numbers. There is no rebalancing advice, no basket NAV, and no performance claim. Unpriced holdings that are not in the basket are omitted rather than shown at a fabricated 0%.

## Strategy simulator

Pure engine: `calculateHoldingsScenario()` in `src/lib/calculations.ts`, used by both basket and portfolio modes.

For starting amount `A`, positions with allocation `wᵢ` and hypothetical move `mᵢ` (%):

```
startingValueᵢ  = A × wᵢ / Σw            (allocations are normalized)
resultingValueᵢ = startingValueᵢ × (1 + mᵢ / 100)
pnlᵢ            = resultingValueᵢ − startingValueᵢ
finalValue      = Σ resultingValueᵢ
P&L             = finalValue − Σ startingValueᵢ
return %        = P&L / Σ startingValueᵢ × 100
```

Values round to cents, return to 0.1%; moves are clamped to −90% … +200%. Every simulation opens at **0%** on every position. The simulator carries a _Hypothetical_ badge and a "not a forecast" label. Worked example (unit-tested): $10,000 split 30/30/20/20 with moves +25%/−10%/+15%/+40% → $11,550 final, +$1,550 P&L, +15.5% return.

## Security model

- **No keys, no signing.** The app only reads public chain data by address. There is no wallet adapter, no signing library, and no input that accepts a private key or seed phrase.
- **`HELIUS_API_KEY` is server-only.** Read via `env()` in `src/lib/env.server.ts` (which ignores `VITE_`-prefixed file entries), used only in `src/lib/helius.server.ts`, never passed through Vite `define`, and never in the client bundle. `.env*` files are git-ignored except `.env.example`.
- **Error hygiene.** Upstream errors are reduced to fixed messages in production; Helius key fragments are redacted; wallets are the only user input and are validated before use.
- **CI** runs with `permissions: contents: read`.

See [`SECURITY.md`](SECURITY.md) for reporting and scope.

## Limitations

- Cost basis only covers stablecoin (USDC/USDT) swaps. Swaps against SOL or other tokens, OTC transfers, and airdrops are treated as transfers with unknown cost, so affected positions show _Cost basis unavailable_.
- History depth is bounded (Helius: 600 transactions; public RPC: last 40 signatures). Older activity marks history as partial.
- Prices are the catalog's current `tokenPrice`; there is no historical price series and no charts of performance.
- Baskets, saves and view counts are per-browser (`localStorage`). There is no account system or shared backend for baskets.
- Categories come from a static PreLaunch symbol map, not the PreStocks API; unknown symbols default to "Infrastructure".
- PreStocks provide economic exposure and do not represent ownership of the referenced companies. Nothing in PreLaunch is investment advice or an offer of securities.

## Local development

Requires **Node.js ≥ 22.12**.

```bash
npm ci
cp .env.example .env.local   # optional; add HELIUS_API_KEY for richer history
npm run dev                  # http://localhost:8080
```

| Variable         | Required | Scope       | Purpose                                                                                                                                                     |
| ---------------- | -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HELIUS_API_KEY` | No       | Server only | Helius DAS balances and Enhanced Transactions history. Without it, public RPC is used and history/cost basis may be partial. **Never prefix with `VITE_`.** |

Portfolio pages call live services (PreStocks API, Solana RPC/Helius), so they need network access.

## Testing and CI

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm test            # node --test on src/**/*.test.ts
npm run build       # vite build (Nitro, Vercel preset), then db:migrate (no-op: there is no migrations/ directory)
```

Unit tests cover wallet validation, mint matching, price-unavailable handling, transaction parsing, average cost, comparison, basket allocation validation, discovery/ranking and the simulator math.

`npm run test:template` runs the kept hosting scripts' own tests (`scripts/*.test.mjs`: env wrapper, PWA/OG head, migration plan). Several expect platform-provided files (`.grok/…`, `public/__grok/…`) that are not in this repository, so they are not part of the CI gate.

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, lint, test and build on Node 22 for pushes and pull requests to `main`. Dependabot checks npm and GitHub Actions weekly.

## Hosting (grok.me)

The live app at https://prelaunched.grok.me/ is built and deployed by the Grok app builder from this repository. The template wiring it relies on is kept as-is:

| Piece                                                                     | Role                                                                                                                                            |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/with-app-env.mjs`                                                | Wraps `dev`, `build`, `build:dev` and `preview`; merges `VITE_*` values from `.grok/app-env.json` (platform-provided, not in the repo).         |
| `scripts/grok-pwa-plugin.mjs`, `grok-pwa-shared.mjs`, `install-page.html` | Vite plugin (dev/preview): web manifest, apple-touch-icon, OG/share card, `grok.com/grok-app-builder/extensions.js`, and the `?install=1` page. |
| `server/middleware/grok-pwa.ts`                                           | The deployed half of the same head wiring, registered through Nitro `serverDir: "./server"`.                                                    |
| `src/lib/og/site.json`                                                    | OG card identity read by the PWA/OG code.                                                                                                       |
| `scripts/app-env-plugin.mjs`                                              | Dev-only `/__app-env` endpoint.                                                                                                                 |
| `scripts/migrate.mjs`, `migration-plan.mjs`                               | The platform build's `db:migrate` step. PreLaunch has no database and no `migrations/` directory, so it exits without connecting.               |
| `isWorkspacePreview()` in `src/lib/env.server.ts`                         | Workspace preview vs deployed app (`GROK_PROJECT_ID`); detailed upstream errors show only in the preview or non-production builds.              |

The icons (`/__grok/icon-180.png`) and OG image come from the platform, not this repository.

## Repository structure

```
src/
  routes/                 Pages + GET /api/portfolio/$wallet
  components/             UI (simulator, cards, allocation bar/donut, shadcn-style ui/)
  lib/
    prestocks-api.ts      Catalog fetch + normalization
    helius.server.ts      Helius balances/history (server-only)
    solana-rpc.server.ts  Public RPC fallback (server-only)
    helius-history.ts     Transaction → PreStock movement parsing
    portfolio.ts          Mint matching, pricing, snapshot, summary notes (pure)
    cost-basis.ts         Average-cost engine (pure)
    compare.ts            Wallet vs basket (pure)
    calculations.ts       Simulator + allocation stats (pure)
    basket-validation.ts  Allocation rules (pure)
    baskets.ts            Basket store (localStorage)
    community.ts          Local saves / views / ranking
    portfolio-load.server.ts  Server orchestration
  types/                  Portfolio + PreStocks types
  data/mock-baskets.ts    Seed strategies
server/                   Nitro middleware: Grok PWA/OG head (deployed)
scripts/                  Grok hosting wiring: env wrapper, PWA/OG plugin, migrate step
docs/                     Architecture and data model
```

---

PreLaunch is read-only research tooling built on the public PreStocks catalog.
