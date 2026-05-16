# CLAUDE.md

Conventions for any future AI session working in this repo. Short on
purpose — read `README.md` for the why, this is the *how*.

## Stack baseline

- Next.js 16 App Router. Pages are Server Components unless they need
  state/effects/event handlers; client components are explicitly
  marked with `"use client"`.
- React 19. Don't reach for state libraries.
- TypeScript strict + `noUncheckedIndexedAccess`. If you read an array
  index, narrow it before using.
- Tailwind v4 with `@theme` tokens in `app/globals.css`. No tailwind
  config file.

## Project layout

- `app/api/transactions/[id]/{invoice,retry}/route.ts` — mock endpoints.
- `lib/server/{seed,store,delay}.ts` — in‑memory store. **Singleton,
  mutable.** Successful retries flip a transaction from `failed` to
  `success` in place; state resets on server restart. Every module
  under `lib/server/` starts with `import "server-only"`; keep that
  line on any new file added there so a client import fails the build
  instead of silently bundling the store.
- `lib/api.ts` — the typed fetch wrappers the UI imports. Add new
  endpoints here, not inline.
- `lib/format.ts` — currency + date helpers. Use these, don't inline
  `Intl.*` calls elsewhere.
- `components/transactions-table.tsx` — owns selection and the retry
  reducer. The hot path: keep the dispatch‑per‑resolved‑promise shape;
  do **not** `Promise.all` the retries. The reducer treats
  `RETRY_RESOLVED` as valid only for a row currently in `retrying`;
  stale resolutions on an already‑settled row are dropped. No path
  here actually double‑resolves an id (selection clears and the row
  leaves the selectable set the instant a retry starts) — this is a
  defensive state‑machine invariant, not a fix for an observed race.
  Keep it: it keeps the reducer correct under any out‑of‑order or
  duplicate dispatch.
- `components/download-invoice-button.tsx` — owns its own
  `isGenerating` state. Don't lift it.

## Tests

- Vitest with jsdom. Globals are enabled (`describe`, `it`, etc. are
  in scope without imports; type via `vitest/globals` in tsconfig).
- MSW intercepts fetch with `onUnhandledRequest: "error"`. Every test
  must explicitly mock the endpoints it touches.
- For timing‑sensitive UI assertions (Generating state, retry in
  flight), use `test/helpers/deferred.ts` and resolve the handler
  manually rather than waiting on real timers.
- Test the behaviour, not the implementation. The headline retry test
  (`transactions-table.test.tsx`) resolves three retries out of order;
  preserve that contract.

## Things that have already burned us

- `URL.createObjectURL` is **not** in jsdom. Tests that exercise the
  download path stub it via `Object.defineProperty(URL, ...)`.
- `HTMLAnchorElement.click` is **not** in jsdom either — invoking it
  logs `"Not implemented: navigation to another Document"` to stderr.
  The download‑button test stubs the prototype in `beforeEach` to keep
  CI output clean and to give tests a spy they can assert against.
- `getByText` matches both visible text and `sr-only` text. Prefer
  `getByRole` with name regex when the same string can appear twice.
- The retry endpoint rejects with 409 if called on a non‑failed
  transaction. The reducer handles `RETRY_RESOLVED` with `"failed"`
  even on network errors so the row never gets stuck on a spinner.

## Commit style

Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`,
`feat(scope):` when the scope adds clarity). Body wraps at ~72 chars,
leads with *why*, not *what*. Each commit must leave the repo in a
state where `typecheck`, `lint`, `test`, and `build` all pass.

## Verification before claiming done

```
npm run typecheck && npm run lint && npm test && npm run build
```

All four must pass clean. Don't ship past a red gate.
