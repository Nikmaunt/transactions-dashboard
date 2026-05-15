import "server-only";
import type { Transaction } from "@/lib/types";
import { seedTransactions } from "./seed";

const transactions: Transaction[] = seedTransactions.map((t) => ({ ...t }));

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
