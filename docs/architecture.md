# Architecture

PreLaunch is a single TanStack Start application. The same codebase renders pages on the server (SSR), hydrates them in the browser, and exposes server functions and one JSON route. Production builds are emitted by Nitro with the Vercel preset (`.vercel/output`).

PreLaunch is **read-only**: it reads a public catalog and public Solana chain data by wallet address. It has no wallet connection, signing, trading, swap, order, or custody code paths.

## Layers

| Layer               | Location                                                                                                                                                           | Responsibility                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Routes (UI)         | `src/routes/*.tsx`                                                                                                                                                 | Pages, URL search params, loading/empty/error states.                                                                                     |
| Components          | `src/components/`                                                                                                                                                  | Presentational pieces: `strategy-simulator`, `allocation-bar`, `allocation-donut`, cards, `ui/` primitives (Radix + Tailwind).            |
| Server functions    | `src/lib/*.functions.ts`                                                                                                                                           | `getPreStocksFn` (GET) and `getPortfolioFn` (POST). They dynamically import server-only modules.                                          |
| Server-only modules | `src/lib/*.server.ts`                                                                                                                                              | Helius + public RPC clients, env access, portfolio orchestration. Each throws if evaluated where `window` exists.                         |
| Pure domain logic   | `src/lib/portfolio.ts`, `cost-basis.ts`, `helius-history.ts`, `compare.ts`, `calculations.ts`, `basket-validation.ts`, `discovery.ts`, `ranking.ts`                | Deterministic functions with unit tests. No I/O.                                                                                          |
| Grok hosting wiring | `scripts/with-app-env.mjs`, `scripts/grok-pwa-*.mjs`, `scripts/app-env-plugin.mjs`, `scripts/migrate.mjs`, `server/middleware/grok-pwa.ts`, `src/lib/og/site.json` | Kept from the app-builder template for the grok.me deploy: env wrapper, PWA manifest/icons, OG card, `extensions.js`, no-op migrate step. |
| Browser stores      | `src/lib/baskets.ts`, `community.ts`, `portfolio-cache.ts`                                                                                                         | `localStorage` / `sessionStorage` persistence.                                                                                            |

## Request flows

### Catalog

```
__root.tsx loader ──▶ getPreStocksFn ──▶ fetchPreStocks()          (src/lib/prestocks-api.ts)
                                           └─ GET https://prestocks.com/api/prestocks
                                              normalizePreStock() → PreStock[]   (60 s module cache)
useCatalog() (src/lib/catalog.ts) reads the loader data in any route.
```

If the catalog request fails, the loader returns `{ stocks: [], stocksError }` and pages render an explicit catalog error state (`src/components/catalog-state.tsx`) with a retry.

### Portfolio

```
/portfolio?wallet=… ──▶ getPortfolioFn({ wallet, fresh }) ──▶ loadPortfolio()   (portfolio-load.server.ts)
    1. isSolanaAddress(wallet)                       → INVALID_WALLET
    2. fetchPreStocks()                              → PRESTOCKS_REQUEST_FAILED
    3. fetchWalletFungibles(wallet, { mints })       → HELIUS_* errors / public RPC errors
         Helius DAS getAssetsByOwner → searchAssets  (if HELIUS_API_KEY)
         else / on failure: public RPC getTokenAccountsByOwner (Token-2022), filtered to catalog mints
    4. fetchWalletHistory(wallet)                    → failure only downgrades historyStatus
         Helius Enhanced Transactions (≤ 6 × 100)    (if HELIUS_API_KEY)
         else / on failure: getSignaturesForAddress(40) + getTransaction → fromParsedRpcTransaction()
       parsePreStockTransactions(raw, wallet, catalog)
    5. buildPortfolioSnapshot(wallet, tokens, catalog, fetchedAt, history)
         matchPreStockHoldings → applyAverageCost → positionCostFromState → totals
◀── PortfolioResponse { ok: true, snapshot } | { ok: false, error, code, message }
```

`GET /api/portfolio/$wallet` (`src/routes/api/portfolio.$wallet.ts`) calls the same `loadPortfolio()` and maps the snapshot to a JSON shape. Status codes: 400 invalid wallet, 503 Helius config/auth, 502 upstream failures.

Caching: catalog 60 s (module scope), wallet balances 30 s and history 30 s per wallet (module scope, server). `fresh: true` (Refresh button) bypasses them. The browser keeps the last snapshot in `sessionStorage` (`prelaunch.portfolio.snapshot.v2`) so `/simulator` and `/compare` can render immediately while re-fetching.

### Baskets

```
/create ──▶ BasketDraft (autosaved to localStorage "prelaunch.draft.v1")
        ──▶ baskets.validateDraft() → validateAllocations()   (basket-validation.ts)
        ──▶ baskets.publish() → saveBasket() → localStorage "prelaunch.baskets.v1"
/basket/$id ──▶ baskets.getById(): local baskets first, then seed baskets (src/data/mock-baskets.ts)
```

Publishing is a local write. It does not call any server, and it does not create a token, liquidity, an order, or a blockchain transaction.

### Compare and simulate

Both are client-side and pure:

- `/compare` loads the wallet snapshot (server function) and a basket (local store), then calls `comparePortfolioToBasket()`.
- `/simulator` and the simulator on `/basket/$id` build `BasketHolding[]` (from a basket via `resolveHoldings()`, or from a snapshot via `portfolioHoldingsFromSnapshot()`) and call `calculateHoldingsScenario()` on every input change.

## Server-only boundary

| Module                             | Guard                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/env.server.ts`            | Reads `process.env`, then `.env.local` / `.env` (and `/workspace/.env.local` in the Grok workspace); skips `VITE_*` keys from files. |
| `src/lib/helius.server.ts`         | `if (typeof window !== "undefined") throw` at module top. Only consumer of `HELIUS_API_KEY`.                                         |
| `src/lib/solana-rpc.server.ts`     | Same guard.                                                                                                                          |
| `src/lib/portfolio-load.server.ts` | Imported only via `await import()` inside server function / API handlers.                                                            |

The client build (`.vercel/output/static`) contains no `HELIUS_API_KEY`, `helius-rpc` host, or `api-key=` string; this is checked as part of the release checklist in [`SECURITY.md`](../SECURITY.md).

## Error handling principles

- **Never substitute data.** Missing price → `null` + _Unavailable_; missing history → `historyStatus: "unavailable"`; truncated history → `"partial"`.
- **Degrade, don't fail.** History problems never hide holdings; Helius problems fall back to public RPC.
- **Fixed messages in production.** Detailed upstream messages are shown only in the Grok workspace preview (`isWorkspacePreview()`: no `GROK_PROJECT_ID`) or non-production builds (`detailEnabled()` in `portfolio-load.server.ts`).

## PreStocks catalog

- `GET https://prestocks.com/api/prestocks` (public JSON array). Consumed fields: `name`, `symbol`, `description`, `image`, `external_url`, `contract_address`, `tokenPrice`, `markPrice`, `markValuation`, `impliedValuation`, `supply`.
- `normalizePreStock()` upper-cases the symbol (used as the internal id), derives a display name, and assigns a PreLaunch-only category from a static symbol map (`src/lib/prestock-meta.ts`; unknown symbols default to "Infrastructure") because the API has no categories.
- Rows without a string `name` and `symbol` are dropped; an empty or non-array response is an error. Only catalog assets are shown.

## Helius and public RPC

| Step     | With `HELIUS_API_KEY`                                                                                                                                     | Without it / on Helius failure                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Balances | DAS `getAssetsByOwner` (fungibles, paged, ≤ 5 × 1000), falling back to `searchAssets` (`tokenType: fungible`)                                             | `getTokenAccountsByOwner` for the Token-2022 program on public RPC, filtered to catalog mints                                        |
| History  | Enhanced Transactions `GET /v0/addresses/{wallet}/transactions` (≤ 6 pages × 100, `token-accounts=balanceChanged`); on 404 retries the `api-mainnet` host | `getSignaturesForAddress` (last 40) + `getTransaction` (jsonParsed), converted to the enhanced shape by `fromParsedRpcTransaction()` |

Public RPC (`src/lib/solana-rpc.server.ts`) rotates between `api.mainnet-beta.solana.com` and `solana-rpc.publicnode.com`, uses a 12 s timeout, and retries rate-limited responses up to 3 times with linear back-off. Helius 401/403 surfaces as `HELIUS_AUTH_ERROR`; `api-key=` fragments in upstream error text are redacted. History is marked **partial** when the page/signature limit is hit.

## Asset matching and cost basis

Wallet tokens match PreStocks **only by exact mint / `contract_address`** (trimmed, never case-folded; names and symbols are never used). Multiple token accounts of one mint are summed; non-catalog mints are ignored.

Cost basis uses **average cost** per mint, processed chronologically (`src/lib/cost-basis.ts`). Classification (`src/lib/helius-history.ts`):

- **Buy** — a swap where exactly one PreStock comes in and USDC/USDT (the only assets valued, at $1) goes out. Cost = stablecoins paid.
- **Sell** — exactly one PreStock goes out and USDC/USDT comes in. Proceeds = stablecoins received.
- **Transfer in / out** — everything else, including swaps against non-stable assets and multi-PreStock swaps.

Rules:

- Incoming transfers are not buys; they add _unknown-cost_ quantity. Outgoing transfers are not sales; they reduce quantity (unknown-cost first) and realize nothing.
- A sale realizes P&L only if proceeds are known _and_ the sold quantity is fully covered by known-cost inventory; otherwise realized P&L is unavailable.
- A position's cost basis is reported only when known-cost quantity matches the on-chain quantity (1e-6 relative tolerance) with no unknown-cost tokens. Portfolio totals require every holding covered and history status `ok`.
- The current catalog price is never used as a historical purchase price.

## Simulator math

`calculateHoldingsScenario()` in `src/lib/calculations.ts`, for amount `A`, allocations `wᵢ`, moves `mᵢ` (%):

```
startingValueᵢ  = A × wᵢ / Σw
resultingValueᵢ = startingValueᵢ × (1 + mᵢ / 100)
P&L             = Σ resultingValueᵢ − Σ startingValueᵢ
return %        = P&L / Σ startingValueᵢ × 100
```

Values round to cents, return to 0.1%; moves clamp to −90% … +200%; every position opens at 0%. Unit-tested example: $10,000 split 30/30/20/20 with +25/−10/+15/+40% → $11,550, +$1,550, +15.5%.

## Build and deploy

- `npm run build` → `node scripts/with-app-env.mjs vite build` (TanStack Start + Nitro, Vercel preset, into `.vercel/output`), then `npm run db:migrate` (`scripts/migrate.mjs`). PreLaunch has no database and no `migrations/` directory, so the migrate step exits without connecting; it stays so the platform build keeps its original shape.
- Nitro registers `server/middleware/grok-pwa.ts` via `serverDir: "./server"`; `scripts/grok-pwa-plugin.mjs` does the same job in dev/preview. Together they add the web manifest, apple-touch-icon, OG card and `grok.com/grok-app-builder/extensions.js`. Icons and the OG image are served by the platform.
- `vite.config.ts` has no `define` block; environment values reach the client only through Vite's standard `VITE_` prefix, which PreLaunch does not use for secrets.
