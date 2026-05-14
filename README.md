# Transactions Dashboard

A small Next.js 16 / React 19 / TypeScript app that simulates a subscription
billing UI: a customer can review their transaction history, download a per‑transaction invoice, and retry failed payments in bulk with each row resolving independently.

## Quickstart

```bash
npm install
npm run dev                 # http://localhost:3000
npm run typecheck           # tsc --noEmit
npm run lint                # eslint
npm test                    # vitest (one shot)
npm run test:watch          # vitest --watch
npm run build               # production build
npm start                   # serve the production build
```

Requires Node 20 (the version this project was built against; Next 16
needs ≥ 20.9). A working install of npm is sufficient — no other tooling.

## Functional walkthrough

The single page at `/` renders the transaction list. Per‑row:

- **Download Invoice** — fetches `GET /api/transactions/[id]/invoice`,
  which simulates a 2‑second "generating PDF" delay before returning a
  text/plain blob with `Content-Disposition: attachment`. The browser
  triggers a real download; a Sonner toast announces success or error.
- **Failed rows** show a checkbox. Selecting any number of failed rows
  enables the **Retry Selected (N)** button at the top.
- Clicking Retry Selected fires `POST /api/transactions/[id]/retry`
  concurrently for every selected id. Each call sleeps for a random
  1–4 seconds server‑side and resolves with a 20 % failure rate. Each
  row independently flips from a spinner to its new status the instant
  its own response lands — order doesn't matter and the rows are not
  coupled to each other.

A row that fails the retry becomes selectable again, so the user can
keep retrying.

## Architecture

```
app/
├── layout.tsx                                 # html, fonts, <Toaster />
├── page.tsx                                   # Server Component
└── api/transactions/[id]/
    ├── invoice/route.ts                       # GET — 2s delay → text blob
    └── retry/route.ts                         # POST — 1–4s delay, 20% fail
components/
├── transactions-table.tsx                     # 'use client' — selection + retry reducer
├── download-invoice-button.tsx                # 'use client' — local generating state
├── status-badge.tsx                           # status → label + colour
└── __tests__/                                 # component tests
lib/
├── types.ts                                   # Transaction, RetryResult
├── format.ts                                  # Intl.* wrappers
├── api.ts                                     # typed fetch wrappers
├── server/{seed,store,delay}.ts               # in‑memory data layer
└── __tests__/format.test.ts
test/
├── setup.ts                                   # jest‑dom + MSW lifecycle
├── msw/{server,handlers}.ts
└── helpers/deferred.ts
```

### Server Component for first paint, Route Handlers for mutations

`app/page.tsx` is a Server Component that calls `listTransactions()`
from the in‑memory store **directly** and passes the snapshot to the
`<TransactionsTable>` client component. There is no
`GET /api/transactions` endpoint because nothing calls it — the page
already has the data, and an HTTP hop to itself would be wasteful.

Mutations (`invoice`, `retry`) ride over HTTP because the client needs
to fire them on demand and observe per‑row results.

### State model for the batch retry — the technical centrepiece

The table owns two pieces of state, both immutable‑update style:

- **Selection** — `ReadonlySet<string>` via `useState`. Only failed,
  not‑currently‑retrying, not‑already‑recovered rows are selectable.
- **Per‑row retry state** — `Map<string, "retrying" | "succeeded" |
  "failed">` driven by a small `useReducer`. Two actions:
  `RETRY_STARTED` (marks every id in the batch as `retrying` in one
  update) and `RETRY_RESOLVED` (updates one id with a server‑confirmed
  outcome).

The dispatch site is the key piece of code:

```ts
function handleRetrySelected() {
  const ids = selectionList;
  if (ids.length === 0) return;
  dispatch({ type: "RETRY_STARTED", ids });
  setSelection(new Set());
  retryButtonRef.current?.focus();
  for (const id of ids) {
    retryTransaction(id)
      .then(result => dispatch({ type: "RETRY_RESOLVED", id, status: result.status }))
      .catch(() => dispatch({ type: "RETRY_RESOLVED", id, status: "failed" }));
  }
}
```

Things to notice about that loop:

- **No `Promise.all`.** Each promise is independent; each dispatch is
  its own React render. A row flips the moment its own request lands,
  not when the slowest row in the batch lands.
- **No `useTransition`.** Transitions deprioritise updates so that
  urgent input isn't blocked. The row updates *are* the urgent UI in
  this flow — wrapping them in a transition would defer them, which is
  the opposite of what the spec asks for.
- **No `useOptimistic`.** The server is the source of truth for retry
  success. Optimistically showing "Success" would be a lie that the
  user pays for when a 20 % retry actually fails.
- **Focus stays on the Retry button** after dispatch so keyboard users
  aren't ejected somewhere surprising when the selection clears.

`effectiveStatus()` folds the retry result into the displayed status
so a successfully retried row shows `Success` without needing to refetch
the underlying transaction.

## Key decisions and trade‑offs

| Decision | Why | Trade‑off accepted |
|---|---|---|
| **No state management library** | One page, no cross‑tree shared state. React 19's local state is sufficient and adding Redux/Zustand/Jotai for this would not survive a code review. | If the app grows beyond one screen, a store may be wanted; the reducer pattern in `transactions-table.tsx` would lift cleanly. |
| **No TanStack Query** | One resource, server‑rendered on first load, mutations are one‑shot fetches with per‑row state. Query's cache layer brings no value at this scope. | Would be the obvious thing to add if real backend pagination, refetching, or polling joined the requirements. |
| **No TanStack Table** | One simple, semantic `<table>`. Headless tables earn their weight at sortable/filterable/virtualised scale, not here. | Adding column sorting later would require either implementing sort by hand or pulling in the lib. |
| **Hand‑crafted seed instead of `@faker-js/faker`** | 25 transactions are reviewable in the diff; reproducible without seeding. Adding faker would be a 5 MB devDep for no real gain. | Variety of data is limited to what I wrote; production datasets would need a generator. |
| **MSW for tests, not a custom mock layer** | Tests exercise the real fetch path through to JSON parsing; refactoring the data layer can't accidentally bypass coverage. | Slightly more setup ceremony than mocking `lib/api.ts` directly. |
| **Vitest over Jest** | 2026 consensus for new Next projects: ESM‑native, faster, Jest‑compatible API, official Next.js guide. | Some IDE plugins are still more polished for Jest. |
| **Sonner for toasts** | 2.5 KB, accessible defaults (`aria-live`), idiomatic in the Next.js/shadcn ecosystem. The spec calls for a notification, this is the smallest sensible choice. | If we ever needed a notification *centre*, we'd outgrow Sonner. |
| **`lucide-react` for icons** | Tree‑shakes per import; only two icons used ship in the client bundle (`Download`, `Loader2`). | Could be replaced by inline SVG with one less dep; not worth the work. |
| **Mock store is in‑process, mutable, non‑persistent** | A successful retry mutates the store so the row stays "Success" across page reloads. Server restart resets the data — that's the right behaviour for a mock. | Two browser tabs share state (one process); a multi‑user scenario would need an actual DB. Documented in `lib/server/store.ts` and CLAUDE.md. |
| **Mobile fallback is `overflow-x-auto`, not a card layout** | A semantic `<table>` is the right element for tabular data; a responsive card breakpoint is meaningful work for a single‑page take‑home. | Below ~720 px wide the user scrolls horizontally rather than seeing a stacked view. |
| **No E2E tests (Playwright)** | The component tests with MSW already cover both critical flows end‑to‑end at the fetch boundary. Adding a Playwright suite for one page would be ceremony. | A regression in routing or layout wouldn't be caught — but there's only one route. |

## Testing strategy

Three suites at the **meaningful behavioural boundaries**:

1. **`lib/format.test.ts`** — pure functions. Currency edge cases (zero,
   thousands, alternate currencies) and the date formatter's
   deterministic UTC output.
2. **`components/__tests__/download-invoice-button.test.tsx`** — the
   in‑flight `Generating…` state (held open by a deferred MSW handler,
   then released to verify the button settles back), the actual
   browser download path (spying on `document.createElement` to
   capture the synthetic `<a>` click and asserting
   `createObjectURL`/`revokeObjectURL`), and the error path.
3. **`components/__tests__/transactions-table.test.tsx`** — the headline
   test renders three failed rows, gates the MSW retry handler with
   per‑id deferred promises, then resolves them **out of natural order**.
   After each release we assert that *exactly* the resolved row
   updated and the others are still showing the spinner. This is the
   test that fails if anyone refactors the dispatch into a
   `Promise.all`.

What we deliberately don't test:

- **Route handler internals.** They are the mock; testing them tests
  our test infra rather than production behaviour.
- **Sonner / Next.js / lucide internals.** Third‑party.
- **A11y matchers.** No automated axe run; the a11y posture is the
  result of using semantic HTML and ARIA correctly, which is verified
  by reading the component, not by a snapshot. (See *What I'd add
  with more time*.)

## Accessibility

- The transaction list is a real `<table>` with `<thead>`/`<tbody>` and
  `<th scope="col">` — screen readers parse it as tabular data.
- Per‑row checkboxes are native `<input type="checkbox">` with
  per‑row `aria-label="Select transaction <id>"`. The header has a
  Select‑all checkbox with proper `indeterminate` state (set via a ref;
  no other way to set that DOM property).
- The retry batch announces itself via a single `aria-live="polite"`
  status line above the table that flips to
  `"Retrying N transactions…"` — one announcement region, no per‑cell
  noise.
- Status is encoded by both colour *and* text label; a row that loses
  colour remains legible.
- Buttons use real `disabled` only when the action is genuinely
  unavailable.
- Focus is managed: it stays on the Retry button after dispatch so the
  keyboard user doesn't jump around.
- Sonner provides aria‑live announcements for toasts.

## Verification (all clean on this commit)

```
npm run typecheck    ✓
npm run lint         ✓
npm test             ✓ 3 files, 14 tests
npm run build        ✓ all routes generated
curl GET  /          ✓ 200, page renders Transactions
curl POST /api/transactions/txn_001/retry  ✓ 200, JSON {id, status}
curl GET  /api/transactions/txn_002/invoice ✓ 200 with attachment header after 2 s
```

## What I'd add with more time

In rough priority order:

1. **Automated a11y check** — `jest-axe` (via `vitest-axe`) on each
   component test would catch ARIA regressions. I left it out because
   the value scales with the number of components; at three, manual
   review is faster.
2. **Card layout below `sm`** — a `display: block` per‑row card view
   so the mobile experience matches the desktop one. Currently the
   user scrolls horizontally.
3. **Pagination / virtualisation** — at 25 rows nothing matters; at
   2 500 the per‑row spinner mounts would start to hurt. `useVirtual`
   from TanStack Virtual is the obvious answer.
4. **Server‑driven sorting / filtering** — would justify TanStack Query
   for caching and TanStack Table for the headless table machinery.
5. **Real invoice rendering** — PDF generation server‑side
   (`pdf-lib` is light) so the downloaded file is a real PDF rather
   than the text mock.
6. **Persistence** — even a SQLite file would let the in‑memory store
   survive restarts and make multi‑tab usage coherent.
7. **An idle‑retry batch progress bar** — at the moment progress is
   communicated per row; a header `"3 of 5 done"` would be friendlier
   for big batches.
8. **Error boundary** for the table so a broken row doesn't take down
   the whole page; not needed at this scope but useful when the data
   becomes user‑shaped.

## Tech stack (with rationale)

- **Next.js 16.2** App Router (Turbopack stable, React Compiler stable).
- **React 19.2** (Server / Client component split).
- **TypeScript 5** strict + `noUncheckedIndexedAccess`.
- **Tailwind v4** — CSS‑first config (`@theme`), tiny production CSS.
- **Sonner 2** — toast notifications.
- **lucide-react** — icons.
- **Vitest 4** + **Testing Library** + **MSW 2** — tests + fetch mocks.

Every runtime dependency is defensible: `next`, `react`, `react-dom`,
`sonner`, `lucide-react` — five entries, nothing else.
