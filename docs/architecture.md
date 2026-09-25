# Architecture

PreLaunch is a single TanStack Start application. The same codebase renders pages on the server (SSR), hydrates them in the browser, and exposes server functions and one JSON route. Production builds are emitted by Nitro with the Vercel preset (`.vercel/output`).

PreLaunch is **read-only**: it reads a public catalog and public Solana chain data by wallet address. It has no wallet connection, signing, trading, swap, order, or custody code paths.

## Layers

| Layer                   | Location                                                                                                                                            | Responsibility                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes (UI)             | `src/routes/*.tsx`                                                                                                                                  | Pages, URL search params, loading/empty/error states.                                                                                                      |
| Components              | `src/components/`                                                                                                                                   | Presentational pieces: `strategy-simulator`, `allocation-bar`, `allocation-donut`, cards, `ui/` primitives (Radix + Tailwind).                             |
| Server functions        | `src/lib/*.functions.ts`                                                                                                                            | `getPreStocksFn` (GET) and `getPortfolioFn` (POST). They dynamically import server-only modules.                                                           |
| Server-only modules     | `src/lib/*.server.ts`                                                                                                                               | Helius + public RPC clients, env access, portfolio orchestration. Each throws if evaluated where `window` exists.                                          |
| Pure domain logic       | `src/lib/portfolio.ts`, `cost-basis.ts`, `helius-history.ts`, `compare.ts`, `calculations.ts`, `basket-validation.ts`, `discovery.ts`, `ranking.ts` | Deterministic functions with unit tests. No I/O.                                                                                                           |
| Browser stores          | `src/lib/baskets.ts`, `community.ts`, `portfolio-cache.ts`                                                                                          | `localStorage` / `sessionStorage` persistence.                                                                                                             |
| Template infrastructure | `src/lib/auth/`, `src/lib/app-data/`, `src/lib/db.ts`, `src/lib/multiplayer/`, `server/`, most of `scripts/`                                        | Inherited from the app-builder template (auth provider, database helper, PWA middleware, env wrappers). No PreLaunch feature reads or writes through them. |

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

| Module                             | Guard                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/lib/env.server.ts`            | Reads `process.env` and `.env.local` / `.env`; skips `VITE_*` keys from files.               |
| `src/lib/helius.server.ts`         | `if (typeof window !== "undefined") throw` at module top. Only consumer of `HELIUS_API_KEY`. |
| `src/lib/solana-rpc.server.ts`     | Same guard.                                                                                  |
| `src/lib/portfolio-load.server.ts` | Imported only via `await import()` inside server function / API handlers.                    |

The client build (`.vercel/output/static`) contains no `HELIUS_API_KEY`, `helius-rpc` host, or `api-key=` string; this is checked as part of the release checklist in [`SECURITY.md`](../SECURITY.md).

## Error handling principles

- **Never substitute data.** Missing price → `null` + _Unavailable_; missing history → `historyStatus: "unavailable"`; truncated history → `"partial"`.
- **Degrade, don't fail.** History problems never hide holdings; Helius problems fall back to public RPC.
- **Fixed messages in production.** Detailed upstream messages are shown only in the workspace preview / non-production builds (`detailEnabled()` in `portfolio-load.server.ts`).

## Build and deploy

- `npm run build` → `scripts/with-app-env.mjs vite build` (TanStack Start + Nitro, Vercel preset) then `scripts/migrate.mjs`, which exits immediately when `DATABASE_URL` is unset and otherwise applies only top-level files in `migrations/` (there are none; see [`data-model.md`](data-model.md)).
- `vite.config.ts` has no `define` block; environment values reach the client only through Vite's standard `VITE_` prefix, which PreLaunch does not use for secrets.
