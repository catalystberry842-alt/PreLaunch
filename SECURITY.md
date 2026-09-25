# Security Policy

## Scope and model

PreLaunch is a **read-only** application. It reads the public PreStocks catalog and public Solana data for a wallet address that the user types in.

- It does **not** connect to wallets, request or store private keys or seed phrases, sign messages, or send transactions.
- It has **no** trading, swap, order, custody, or fund-movement functionality.
- Publishing a basket writes to the user's own browser storage only; it creates no token, liquidity, order, or on-chain transaction.
- No PreLaunch user data is stored server-side.

## Secrets

The only application secret is the optional `HELIUS_API_KEY`.

- It is read on the server via `src/lib/env.server.ts` and used only in `src/lib/helius.server.ts`, which refuses to load in a browser.
- It must never be prefixed with `VITE_` (or any client-exposed prefix) and must not be added to Vite `define`.
- `.gitignore` excludes every `.env*` file except `.env.example`, which contains only a placeholder.
- Upstream error text is scrubbed of `api-key=` fragments before it can reach a response.

### Release checklist

After `npm run build`, confirm the client bundle does not contain the key or Helius endpoints:

```bash
grep -rlE "HELIUS_API_KEY|helius-rpc|api-key=" .vercel/output/static && echo "LEAK" || echo "clean"
```

If you set a real key locally, also grep the static output for the key value itself.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's private vulnerability reporting on this repository (Security → Report a vulnerability) if it is enabled; otherwise contact the maintainer ([@catalystberry842-alt](https://github.com/catalystberry842-alt)) privately first. Include:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected commit or deployment URL.

We aim to acknowledge reports within a few days and will coordinate a fix and disclosure timeline with you.

## Supported versions

Only the latest commit on `main` (and the deployment built from it) is supported.
