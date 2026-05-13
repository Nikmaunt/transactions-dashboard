import type { TransactionStatus } from "@/lib/types";

const STATUS_LABELS: Record<TransactionStatus, string> = {
  success: "Success",
  failed: "Failed",
  pending: "Pending",
  refunded: "Refunded",
};

const STATUS_STYLES: Record<TransactionStatus, string> = {
  success: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  failed: "bg-red-100 text-red-800 ring-red-600/20",
  pending: "bg-amber-100 text-amber-800 ring-amber-600/20",
  refunded: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
