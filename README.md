# Transactions Dashboard

Subscription billing UI: review transaction history, download a
per-transaction invoice, and retry failed payments in bulk with each
row resolving on its own. Next.js 16 · React 19 · TypeScript.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

Requires Node ≥ 20.9.

Other scripts: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build && npm start`.

State is in-memory and resets on server restart; a successful retry
persists for the life of the process.

## Where to look

| Path | What |
|---|---|
| `components/transactions-table.tsx` | Selection + concurrent batch-retry state machine |
| `components/download-invoice-button.tsx` | Per-row invoice download + toast |
| `app/api/transactions/[id]/retry/route.ts` | Mock retry — 1–4 s delay, 20% failure |
| `app/api/transactions/[id]/invoice/route.ts` | Mock invoice — 2 s delay, file download |
| `app/page.tsx` | Server Component; reads the store, renders the table |
| `lib/server/` | In-memory store + seed data |
| `lib/types.ts` | Domain types |

Tests sit next to the code they cover (`*.test.ts[x]`).
