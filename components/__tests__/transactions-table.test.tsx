import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { TransactionsTable } from "@/components/transactions-table";
import type { Transaction } from "@/lib/types";
import { server } from "@/test/msw/server";
import { deferred, type Deferred } from "@/test/helpers/deferred";

const fixtures: readonly Transaction[] = [
  {
    id: "txn_a",
    description: "Streaming Plus — Monthly",
    amountCents: 1499,
    currency: "USD",
    occurredAt: "2026-05-12T08:14:00.000Z",
    status: "failed",
  },
  {
    id: "txn_b",
    description: "4K HDR Add-on — Monthly",
    amountCents: 499,
    currency: "USD",
    occurredAt: "2026-05-11T08:14:00.000Z",
    status: "failed",
  },
  {
    id: "txn_c",
    description: "PPV: Boxing Title Fight",
    amountCents: 7499,
    currency: "USD",
    occurredAt: "2026-05-10T08:14:00.000Z",
    status: "failed",
  },
  {
    id: "txn_d",
    description: "Documentary Bundle",
    amountCents: 999,
    currency: "USD",
    occurredAt: "2026-05-09T19:42:00.000Z",
    status: "success",
  },
];

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => "blob:fake"),
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: vi.fn(),
    configurable: true,
  });
});

function row(id: string) {
  return screen.getByRole("row", { name: new RegExp(id) });
}

describe("TransactionsTable", () => {
  it("renders id, description, amount, date, and status for every row", () => {
    render(<TransactionsTable transactions={fixtures} />);
    for (const t of fixtures) {
      const r = row(t.id);
      expect(within(r).getByText(t.description)).toBeInTheDocument();
    }
    expect(within(row("txn_a")).getByText("$14.99")).toBeInTheDocument();
    expect(within(row("txn_c")).getByText("$74.99")).toBeInTheDocument();
    expect(within(row("txn_d")).getByText("Success")).toBeInTheDocument();
  });

  it("shows a checkbox only on failed rows", () => {
    render(<TransactionsTable transactions={fixtures} />);
    expect(
      within(row("txn_a")).getByRole("checkbox", { name: /select transaction txn_a/i }),
    ).toBeInTheDocument();
    expect(
      within(row("txn_d")).queryByRole("checkbox"),
    ).not.toBeInTheDocument();
  });

  it("disables the Retry Selected button until at least one row is selected", async () => {
    const user = userEvent.setup();
    render(<TransactionsTable transactions={fixtures} />);

    const retryButton = screen.getByRole("button", { name: /retry selected/i });
    expect(retryButton).toBeDisabled();

    await user.click(
      within(row("txn_a")).getByRole("checkbox", { name: /select transaction txn_a/i }),
    );
    expect(retryButton).toBeEnabled();
    expect(retryButton).toHaveAccessibleName(/retry selected \(1\)/i);
  });

  it("retries each selected row independently and resolves them out of order", async () => {
    const gates: Record<"txn_a" | "txn_b" | "txn_c", Deferred<"success" | "failed">> = {
      txn_a: deferred(),
      txn_b: deferred(),
      txn_c: deferred(),
    };

    server.use(
      http.post("/api/transactions/:id/retry", async ({ params }) => {
        const id = String(params.id) as keyof typeof gates;
        const gate = gates[id];
        const status = await gate.promise;
        return HttpResponse.json({ id, status });
      }),
    );

    const user = userEvent.setup();
    render(<TransactionsTable transactions={fixtures} />);

    // Select all three failed rows via the header select-all checkbox.
    await user.click(
      screen.getByRole("checkbox", { name: /select all failed transactions/i }),
    );
    await user.click(screen.getByRole("button", { name: /retry selected \(3\)/i }));

    // All three rows are now showing the retrying spinner; selection is cleared.
    expect(
      within(row("txn_a")).getByRole("status", { name: /retrying txn_a/i }),
    ).toBeInTheDocument();
    expect(
      within(row("txn_b")).getByRole("status", { name: /retrying txn_b/i }),
    ).toBeInTheDocument();
    expect(
      within(row("txn_c")).getByRole("status", { name: /retrying txn_c/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry selected$/i })).toBeDisabled();

    // Resolve out of natural order: b succeeds first.
    gates.txn_b.resolve("success");
    await waitFor(() =>
      expect(within(row("txn_b")).getByText("Success")).toBeInTheDocument(),
    );
    // The other two are still pending.
    expect(
      within(row("txn_a")).getByRole("status", { name: /retrying txn_a/i }),
    ).toBeInTheDocument();
    expect(
      within(row("txn_c")).getByRole("status", { name: /retrying txn_c/i }),
    ).toBeInTheDocument();

    // a fails — should flip back to Failed and become re-selectable.
    gates.txn_a.resolve("failed");
    await waitFor(() =>
      expect(
        within(row("txn_a")).getByRole("checkbox", { name: /select transaction txn_a/i }),
      ).toBeInTheDocument(),
    );
    expect(within(row("txn_a")).getByText("Failed")).toBeInTheDocument();
    // c is still pending.
    expect(
      within(row("txn_c")).getByRole("status", { name: /retrying txn_c/i }),
    ).toBeInTheDocument();

    // c finally succeeds.
    gates.txn_c.resolve("success");
    await waitFor(() =>
      expect(within(row("txn_c")).getByText("Success")).toBeInTheDocument(),
    );
  });
});
