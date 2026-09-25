# Contributing to PreLaunch

Thanks for helping improve PreLaunch. Please read this first — the project has a few non-negotiable product rules.

## Product rules

1. **Read-only.** Do not add trading, swaps, order placement, wallet connection, transaction signing, custody, or anything that asks for a private key or seed phrase.
2. **No invented data.** Every number must come from the PreStocks API, on-chain data, or a documented pure calculation over them. When an input is missing, return `null` and show _Unavailable_ / _Partial_ — never a placeholder, estimate, or `0` standing in for unknown.
3. **PreStocks only.** Do not add unrelated tokens, assets, or data sources.
4. **Hypothetical means hypothetical.** Simulator output must stay labelled as such and must not be presented as a forecast.
5. **Publishing is local.** Publishing a basket shares a strategy idea inside PreLaunch; it must never create a token, liquidity, an order, or a transaction.

## Setup

Requires Node.js ≥ 22.12.

```bash
npm ci
cp .env.example .env.local   # optional: HELIUS_API_KEY=...
npm run dev                  # http://localhost:8080
```

## Before opening a pull request

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

CI runs the same four commands on Node 22. Pull requests must pass them.

- Do not silence errors with `@ts-ignore`, `eslint-disable`, or by deleting/skipping tests. Fix the cause.
- Keep domain logic pure and in `src/lib/` (no I/O), with a colocated `*.test.ts` using `node:test` + `node:assert/strict`. Use relative imports with the `.ts` extension in pure modules so Node can run them with `--experimental-strip-types`.
- Server-only code goes in `*.server.ts` and must be loaded through a server function or API handler (`await import(...)`). Never reference `HELIUS_API_KEY` elsewhere, and never give it a `VITE_` prefix.
- Keep UI changes in the existing visual language: dark, minimal, dense-but-calm; no gradients, decorative animation, or charts of data we do not have.
- Accessibility: every input has a label, icon-only controls have an accessible name, tables have headers with `scope`, and state is never conveyed by colour alone.

## Commits and branches

- Branch from `main`; keep pull requests focused.
- Use conventional-style subjects (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Never commit `.env*` files (only `.env.example` is tracked) or any credential.

## Reporting bugs

Open an issue with steps to reproduce, the wallet address if relevant (it is public data), expected vs actual behaviour, and browser/Node version. For security issues, follow [`SECURITY.md`](SECURITY.md) instead.
