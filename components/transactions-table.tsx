import type { Transaction } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { StatusBadge } from "./status-badge";
import { DownloadInvoiceButton } from "./download-invoice-button";

export function TransactionsTable({
  transactions,
}: {
  transactions: readonly Transaction[];
}) {
  if (transactions.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500">
        No transactions yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
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
          {transactions.map((t) => (
            <tr key={t.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3 align-top">
                <div className="font-medium text-zinc-900">{t.description}</div>
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
                <StatusBadge status={t.status} />
              </td>
              <td className="px-4 py-3 align-top text-right">
                <DownloadInvoiceButton transactionId={t.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
