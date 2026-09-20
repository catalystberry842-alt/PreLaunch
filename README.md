# PreLaunch

Track PreStocks, discover strategies, build baskets, and simulate ideas.

PreLaunch is a **read-only** research and portfolio tool for [PreStocks](https://prestocks.com) — tokenized economic exposure to private companies. It is not a broker, token launchpad, or trading venue.

**Repo:** https://github.com/catalystberry842-alt/PreLaunch

**Demo:** _[add your deployed URL here]_

---

## Problem

PreStocks holders can see tokens in a wallet, but not a clean picture of:

- which names they actually hold
- what those holdings are worth at live catalog prices
- verified cost basis and P&L (when on-chain history supports it)
- how that book compares to a published strategy
- what a hypothetical move in a basket or portfolio would do

Most crypto UIs either invent numbers or imply execution. PreLaunch does neither.

## Solution

Paste a Solana address. PreLaunch matches wallet tokens to the official PreStocks catalog by **contract address / mint**, then lets you research names, publish a basket in the browser, compare allocations, and run a **hypothetical** what-if. No wallet connect. No swaps. No orders.

---

## Core features

| Area | What it does |
| --- | --- |
| **Discover** | Browse PreStocks and thematic baskets. Search names, theses, creators, and symbols. |
| **Research** | Live catalog fields: token price, mark price, implied valuation, supply. |
| **Create / Publish** | Pick 2+ PreStocks, set allocations, write a thesis, publish **in this browser**. Publish ≠ on-chain token launch. |
| **Portfolio** | Holdings, value, allocation, verified transactions, average-cost basis, realized / unrealized P&L when calculable. |
| **Compare** | Wallet vs a basket: overlap, unique names, allocation gap. Informational only. |
| **Simulator** | Hypothetical % scenario on a basket or on current holdings. Not a forecast. |

---

## How PreStocks are used

- Catalog: public `https://prestocks.com/api/prestocks`
- Matching is by `contract_address` / mint, never by name or ticker alone
- Position value = quantity × live `tokenPrice`
- PreStocks are **economic exposure, not ownership** of the referenced companies
- PreLaunch does not list unrelated pre-IPO tokens and does not invent catalog rows

## Portfolio tracking

Paste a Solana address. The server reads Token-2022 accounts (Helius when configured, otherwise public RPC) and keeps only mints that exist in the PreStocks catalog.

## Transaction history + cost basis

- History comes from verified wallet transactions (Helius Enhanced Transactions when `HELIUS_API_KEY` is set, otherwise parsed public RPC history)
- Types: Buy / Acquisition, Sell / Disposal, Transfer
- Incoming transfers are **not** treated as buys
- Outgoing transfers are **not** treated as sales
- Average-cost accounting uses only priced, eligible acquisitions
- Missing price, missing history, or incomplete coverage → **Unavailable** / **Cost basis unavailable**
- Current catalog price is never used as a historical purchase price

## Basket creation

Select PreStocks → set weights → write a thesis → publish. Baskets live in `localStorage` on this device. Publishing does not deploy a token or send a transaction.

## Basket discovery

Featured and newest lists use the real local catalog plus baskets you publish here. Views/saves are local browser metrics, not fabricated market stats.

## Portfolio / basket comparison

Compares live wallet weights to a basket’s reference allocation. Difference = portfolio % − basket %. No rebalance advice.

## Strategy simulator

Same what-if engine for baskets and for portfolio weights. Labelled **Hypothetical**. PreLaunch does not execute trades.

---

## Tech stack

- React 19 + TanStack Start / Router
- Tailwind CSS v4
- PreStocks public API
- Optional [Helius](https://www.helius.dev/) (server-side only)
- Public Solana RPC fallback
- Browser `localStorage` for baskets and saves (no account required)

## Local setup

```bash
npm install
cp .env.example .env.local   # optional
npm run dev
```

App: `http://localhost:8080`

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Environment variables

| Variable | Required | Where | Purpose |
| --- | --- | --- | --- |
| `HELIUS_API_KEY` | No | Server only (`.env.local`) | Richer wallet + transaction history |

Never expose this key in the client. Do **not** prefix it with `VITE_` or `NEXT_PUBLIC_`.

`.env.example`:

```
HELIUS_API_KEY=your_key_here
```

Without the key, holdings still load via public RPC. History and cost basis may be partial or unavailable.

---

## Important limitations / disclosures

- PreStocks provide economic exposure and **do not represent ownership** of the underlying companies.
- Simulations are **hypothetical** and are not predictions or financial advice.
- PreLaunch **does not execute trades**, connect a wallet, or request private keys.
- Cost basis and P&L appear only when verified transaction data supports them. Incomplete data is shown as unavailable — never filled with estimates.
- Published baskets are stored in this browser, not on-chain.
- Nothing here is an offer of securities.

---

Built for hackathon submission. Read-only research tooling on official PreStocks assets.
