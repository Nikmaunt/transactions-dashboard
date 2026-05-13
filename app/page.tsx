import { TransactionsTable } from "@/components/transactions-table";
import { listTransactions } from "@/lib/server/store";

export default function Home() {
  const transactions = listTransactions();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Your recent subscription activity.
        </p>
      </header>
      <TransactionsTable transactions={transactions} />
    </main>
  );
}
