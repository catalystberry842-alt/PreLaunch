# Data model

PreLaunch has no database. Its models are TypeScript types, populated from the PreStocks API, Solana chain data, and the browser's storage. This document lists them as they exist in code.

## Catalog

### `PreStocksApiItem` — `src/lib/types.ts`

Raw row from `GET https://prestocks.com/api/prestocks`.

| Field                                                                    | Type                   |
| ------------------------------------------------------------------------ | ---------------------- |
| `name`, `symbol`, `description`, `image`, `external_url`                 | `string`               |
| `contract_address`                                                       | `string` — Solana mint |
| `tokenPrice`, `markPrice`, `markValuation`, `impliedValuation`, `supply` | `number`               |

### `PreStock` — `src/lib/types.ts`

Normalized catalog entry (`normalizePreStock()` in `src/lib/prestocks-api.ts`).

| Field                                                                    | Type       | Notes                                                                                                     |
| ------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------- |
| `id`                                                                     | `string`   | Upper-cased API symbol.                                                                                   |
| `name` / `officialName`                                                  | `string`   | Display name / name as returned by the API.                                                               |
| `symbol`                                                                 | `string`   | Upper-cased.                                                                                              |
| `category`                                                               | `Category` | PreLaunch-only static map (`prestock-meta.ts`); not from the API.                                         |
| `initials`, `image`, `description`, `externalUrl`                        | `string`   |                                                                                                           |
| `contractAddress`                                                        | `string`   | Mint. The only key used to match wallet assets.                                                           |
| `tokenPrice`, `markPrice`, `markValuation`, `impliedValuation`, `supply` | `number`   | Non-numeric API values normalize to `0`; portfolio pricing treats `≤ 0` as unavailable (`usablePrice()`). |

`Category` = `"AI" | "Robotics" | "Defense" | "Fintech" | "Space" | "Infrastructure" | "Consumer" | "Private Markets" | "Other"`.

## Wallet and portfolio — `src/types/portfolio.ts`

### `WalletToken`

`{ mint: string; quantity: number }` — one token account balance (decimals applied).

### `PortfolioTransaction`

| Field                      | Type                                                               | Notes                                   |
| -------------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| `walletAddress`            | `string`                                                           |                                         |
| `signature`                | `string \| null`                                                   |                                         |
| `timestamp`                | `string \| null`                                                   | ISO 8601.                               |
| `mint`, `symbol`, `name`   | `string`                                                           | Catalog-matched by mint.                |
| `quantity`                 | `number`                                                           | Absolute amount moved.                  |
| `direction`                | `"in" \| "out"`                                                    |                                         |
| `type`                     | `"buy" \| "sell" \| "transfer_in" \| "transfer_out" \| "transfer"` | See cost-basis rules in the README.     |
| `typeLabel`                | `string`                                                           | e.g. "Buy / Acquisition".               |
| `unitPriceUsd`, `valueUsd` | `number \| null`                                                   | Only for stablecoin-settled buys/sells. |
| `costBasisEligible`        | `boolean`                                                          | `true` only for priced buys.            |

### `PortfolioPosition`

`null` always means _unavailable_, never an estimate.

| Field                                 | Type             | Notes                                                |
| ------------------------------------- | ---------------- | ---------------------------------------------------- |
| `symbol`, `name`, `image`, `initials` | `string`         | From the catalog.                                    |
| `contractAddress`                     | `string`         | Mint.                                                |
| `quantity`                            | `number`         | Summed across token accounts.                        |
| `tokenPrice`                          | `number \| null` | Current catalog `tokenPrice`; `null` if missing/≤ 0. |
| `value`                               | `number \| null` | `quantity × tokenPrice`.                             |
| `allocation`                          | `number \| null` | % of priced portfolio value (1 dp).                  |
| `costBasis`                           | `number \| null` | Remaining average-cost basis.                        |
| `unrealizedPnl`                       | `number \| null` | `value − costBasis`.                                 |
| `unrealizedPnlPercent`                | `number \| null` | `unrealizedPnl ÷ costBasis × 100`.                   |

### `PortfolioSnapshot`

| Field                 | Type                                 | Notes                                                                                                    |
| --------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `wallet`, `fetchedAt` | `string`                             |                                                                                                          |
| `totalValue`          | `number`                             | Σ priced position values.                                                                                |
| `unpricedCount`       | `number`                             | Holdings excluded from `totalValue` for lack of a price.                                                 |
| `totalCostBasis`      | `number \| null`                     | Only when every holding has cost basis and history is `ok`.                                              |
| `unrealizedPnl`       | `number \| null`                     | Only when `totalCostBasis` is known and nothing is unpriced.                                             |
| `realizedPnl`         | `number \| null`                     | `0` when loaded history has no sales; `null` if any sale is not fully verifiable or history is not `ok`. |
| `costBasisMethod`     | `"average_cost"`                     |                                                                                                          |
| `positions`           | `PortfolioPosition[]`                | Sorted by value (unpriced last).                                                                         |
| `transactions`        | `PortfolioTransaction[]`             | Newest first.                                                                                            |
| `historyStatus`       | `"ok" \| "partial" \| "unavailable"` |                                                                                                          |
| `historyMessage`      | `string \| null`                     |                                                                                                          |
| `historyTruncated`    | `boolean`                            |                                                                                                          |

### `PortfolioResponse`

`{ ok: true; snapshot } | { ok: false; error; code; message }` where
`error ∈ INVALID_WALLET | HELIUS_CONFIG_MISSING | HELIUS_AUTH_ERROR | HELIUS_REQUEST_FAILED | PRESTOCKS_REQUEST_FAILED` and
`code ∈ invalid_wallet | unavailable | catalog | wallet_read`.

### Internal: `MintCostState` — `src/lib/cost-basis.ts`

Per-mint accumulator: `knownQty`, `knownCost`, `unknownQty`, `realizedPnl`, `realizedReliable`.

## Baskets — `src/lib/types.ts`

### `Basket`

| Field                                      | Type                   | Notes                                                                   |
| ------------------------------------------ | ---------------------- | ----------------------------------------------------------------------- |
| `id`                                       | `string`               | Seed: fixed slug. Local: `slug(name)-base36(timestamp)`.                |
| `name`, `description`, `thesis`, `creator` | `string`               | `creator` is a free-text display name.                                  |
| `category`                                 | `Category`             |                                                                         |
| `featured`                                 | `boolean?`             | Seed baskets only.                                                      |
| `source`                                   | `"catalog" \| "local"` | `catalog` = bundled seed strategy; `local` = published in this browser. |
| `createdAt`, `updatedAt`                   | `string`               | ISO 8601.                                                               |
| `constituents`                             | `BasketConstituent[]`  | `{ preStockId: string; allocation: number }` (percent).                 |
| `views`, `saves`                           | `number`               | Seeds start at 0; counts are local to this browser.                     |

### `BasketDraft`

`{ name, description, category, creator, selectedIds: string[], allocations: Record<string, number>, thesis }` — the `/create` form state. On restore, ids are canonicalized and de-duplicated, and allocations for unselected ids are dropped.

### Derived

- `BasketHolding` = `BasketConstituent & { stock: PreStock | null }` (`null` when the id is not in the live catalog).
- `ResolvedConstituent` = holding with a non-null `stock`.

### Validation — `src/lib/basket-validation.ts`

`validateAllocations(entries)` returns human-readable issues; empty means valid:

1. At least 2 entries.
2. No empty ids; no duplicates after `canonicalizePreStockId()`.
3. Every allocation finite, not negative, and > 0.
4. Total within `ALLOCATION_TOLERANCE` (0.05) of 100.

## Comparison and simulation

- `CompareRow` / `CompareResult` — `src/lib/compare.ts`: `portfolioPercent`, `basketPercent`, `difference`, `portfolioValue`, `side: "both" | "portfolio" | "basket"`, plus insight strings.
- `PositionOutcome` — `src/lib/calculations.ts`: `{ startingValue, resultingValue, pnl }`.
- `ScenarioResult`: `{ rows, startingValue, finalValue, pnl, returnPercent }`.

## Browser storage keys

| Key                               | Storage        | Contents                             |
| --------------------------------- | -------------- | ------------------------------------ |
| `prelaunch.baskets.v1`            | localStorage   | `Basket[]` published in this browser |
| `prelaunch.draft.v1`              | localStorage   | `BasketDraft`                        |
| `prelaunch.saved.v1`              | localStorage   | Saved basket ids                     |
| `prelaunch.metrics.v2`            | localStorage   | Local view counts                    |
| `prelaunch.session-views.v1`      | sessionStorage | Views already counted this session   |
| `prelaunch.portfolio.snapshot.v2` | sessionStorage | Last `PortfolioSnapshot`             |

## Database

None. There is no `migrations/` directory; the build's `db:migrate` step (kept for the Grok platform build) finds nothing to apply and exits without connecting. No PreLaunch data is stored server-side.
