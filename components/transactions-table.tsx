"use client";

import { useMemo, useReducer, useRef, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { RetryOutcome, Transaction, TransactionStatus } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { retryTransaction } from "@/lib/api";
import { StatusBadge } from "./status-badge";
import { DownloadInvoiceButton } from "./download-invoice-button";

export type RowRetryState = "retrying" | "succeeded" | "failed";
export type RetryStateMap = ReadonlyMap<string, RowRetryState>;

export type RetryAction =
  | { type: "RETRY_STARTED"; ids: readonly string[] }
  | { type: "RETRY_RESOLVED"; id: string; status: RetryOutcome };

export function retryReducer(
  state: RetryStateMap,
  action: RetryAction,
): RetryStateMap {
  switch (action.type) {
    case "RETRY_STARTED": {
      const next = new Map(state);
      for (const id of action.ids) next.set(id, "retrying");
      return next;
    }
    case "RETRY_RESOLVED": {
      // Only a row currently in flight can transition to an outcome.
      // A stale resolution (e.g. from a duplicate dispatch) must not
      // overwrite the recorded outcome of an already-resolved row.
      if (state.get(action.id) !== "retrying") return state;
      const next = new Map(state);
      next.set(action.id, action.status === "success" ? "succeeded" : "failed");
      return next;
    }
  }
}

function effectiveStatus(
  base: TransactionStatus,
  retry: RowRetryState | undefined,
): TransactionStatus {
  if (retry === "succeeded") return "success";
  return base;
}

export function TransactionsTable({
  transactions,
}: {
  transactions: readonly Transaction[];
}) {
  const [selection, setSelection] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [retryState, dispatch] = useReducer(
    retryReducer,
    undefined,
    () => new Map() as RetryStateMap,
  );

  const selectableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of transactions) {
      const retry = retryState.get(t.id);
      if (t.status === "failed" && retry !== "retrying" && retry !== "succeeded") {
        ids.add(t.id);
      }
    }
    return ids;
  }, [transactions, retryState]);

  const retryingCount = useMemo(() => {
    let n = 0;
    for (const value of retryState.values()) if (value === "retrying") n += 1;
    return n;
  }, [retryState]);
  const allSelected =
    selectableIds.size > 0 && selection.size === selectableIds.size;
  const someSelected =
    selection.size > 0 && selection.size < selectableIds.size;

  function toggleRow(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelection((prev) =>
      prev.size === selectableIds.size ? new Set() : new Set(selectableIds),
    );
  }

  const retryButtonRef = useRef<HTMLButtonElement | null>(null);

  function handleRetrySelected() {
    const ids = [...selection];
    if (ids.length === 0) return;
    dispatch({ type: "RETRY_STARTED", ids });
    setSelection(new Set());
    retryButtonRef.current?.focus();
    for (const id of ids) {
      retryTransaction(id)
        .then((result) =>
          dispatch({ type: "RETRY_RESOLVED", id, status: result.status }),
        )
        .catch(() =>
          dispatch({ type: "RETRY_RESOLVED", id, status: "failed" }),
        );
    }
  }

  if (transactions.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500">
        No transactions yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          {retryingCount > 0
            ? `Retrying ${retryingCount} transaction${retryingCount === 1 ? "" : "s"}…`
            : selection.size > 0
              ? `${selection.size} selected.`
              : selectableIds.size === 0
                ? "All failed transactions have been retried."
                : "Select failed transactions to retry them in bulk."}
        </p>
        <button
          ref={retryButtonRef}
          type="button"
          onClick={handleRetrySelected}
          disabled={selection.size === 0}
          className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Retry Selected
          {selection.size > 0 ? ` (${selection.size})` : ""}
        </button>
      </div>

      {retryingCount > 0 ? (
        <span role="status" className="sr-only">
          Retrying {retryingCount} transaction
          {retryingCount === 1 ? "" : "s"}…
        </span>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th scope="col" className="w-10 px-4 py-3 text-left">
                <SelectAllCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={selectableIds.size === 0}
                  onChange={toggleAll}
                />
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-semibold text-zinc-900"
              >
                Transaction
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-semibold text-zinc-900"
              >
                Date
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right font-semibold text-zinc-900"
              >
                Amount
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left font-semibold text-zinc-900"
              >
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {transactions.map((t) => {
              const retry = retryState.get(t.id);
              const isRetrying = retry === "retrying";
              const isSelectable = selectableIds.has(t.id);
              const isSelected = selection.has(t.id);
              const displayStatus = effectiveStatus(t.status, retry);

              return (
                <tr
                  key={t.id}
                  className={
                    isSelected
                      ? "bg-zinc-100 hover:bg-zinc-100"
                      : "hover:bg-zinc-50"
                  }
                >
                  <td className="w-10 px-4 py-3 align-top">
                    {isRetrying ? (
                      <span
                        role="status"
                        aria-label={`Retrying ${t.id}`}
                        className="inline-flex"
                      >
                        <Loader2
                          aria-hidden
                          className="h-4 w-4 animate-spin text-zinc-500"
                        />
                      </span>
                    ) : isSelectable ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(t.id)}
                        aria-label={`Select transaction ${t.id}`}
                        className="h-4 w-4 cursor-pointer rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                      />
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-zinc-900">
                      {t.description}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-zinc-500">
                      {t.id}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-zinc-700">
                    {formatDateTime(t.occurredAt)}
                  </td>
                  <td className="px-4 py-3 align-top text-right tabular-nums text-zinc-900">
                    {formatCurrency(t.amountCents, t.currency)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={displayStatus} />
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <DownloadInvoiceButton transactionId={t.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label="Select all failed transactions"
      className="h-4 w-4 cursor-pointer rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
