import "server-only";
import type { Transaction } from "@/lib/types";
import { seedTransactions } from "./seed";

// Next 16 + Turbopack evaluates the App Router page and the API
// routes in separate module graphs, so a plain module-level array
// would exist twice in one process and a route-side retry would be
// invisible to the page on its next render. Pin it on globalThis so
// both graphs share one reference — the standard Next.js dev
// singleton pattern (same as the recommended Prisma client setup).
const globalForStore = globalThis as typeof globalThis & {
  __transactionsStore?: Transaction[];
};

const transactions: Transaction[] = (globalForStore.__transactionsStore ??=
  seedTransactions.map((t) => ({ ...t })));

export function listTransactions(): readonly Transaction[] {
  return transactions;
}

export function findTransaction(id: string): Transaction | undefined {
  return transactions.find((t) => t.id === id);
}

export function markRetrySucceeded(id: string): boolean {
  const t = transactions.find((tx) => tx.id === id);
  if (!t || t.status !== "failed") return false;
  t.status = "success";
  return true;
}
