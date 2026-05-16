import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import {
  TransactionsTable,
  retryReducer,
  type RetryStateMap,
} from "@/components/transactions-table";
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
  {
    id: "txn_e",
    description: "Live Concert Pass",
    amountCents: 2499,
    currency: "USD",
    occurredAt: "2026-05-08T18:30:00.000Z",
    status: "pending",
  },
  {
    id: "txn_f",
    description: "Documentary Bundle — Refunded",
    amountCents: 999,
    currency: "USD",
    occurredAt: "2026-05-07T20:01:00.000Z",
    status: "refunded",
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
    expect(within(row("txn_d")).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(row("txn_e")).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(row("txn_f")).queryByRole("checkbox")).not.toBeInTheDocument();
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

    await user.click(
      screen.getByRole("checkbox", { name: /select all failed transactions/i }),
    );
    await user.click(screen.getByRole("button", { name: /retry selected \(3\)/i }));

    // The batch announces itself through a dedicated live region: a
    // role="status" element whose text content is the batch copy. The
    // per-row spinners are also role="status" but carry no text (their
    // icon is aria-hidden), so only the batch region matches here.
    const statusRegions = screen.getAllByRole("status");
    expect(
      statusRegions.some((el) =>
        /retrying 3 transactions/i.test(el.textContent ?? ""),
      ),
    ).toBe(true);

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

    gates.txn_b.resolve("success");
    await waitFor(() =>
      expect(within(row("txn_b")).getByText("Success")).toBeInTheDocument(),
    );
    expect(
      within(row("txn_a")).getByRole("status", { name: /retrying txn_a/i }),
    ).toBeInTheDocument();
    expect(
      within(row("txn_c")).getByRole("status", { name: /retrying txn_c/i }),
    ).toBeInTheDocument();

    gates.txn_a.resolve("failed");
    await waitFor(() =>
      expect(
        within(row("txn_a")).getByRole("checkbox", { name: /select transaction txn_a/i }),
      ).toBeInTheDocument(),
    );
    expect(within(row("txn_a")).getByText("Failed")).toBeInTheDocument();
    expect(
      within(row("txn_c")).getByRole("status", { name: /retrying txn_c/i }),
    ).toBeInTheDocument();

    gates.txn_c.resolve("success");
    await waitFor(() =>
      expect(within(row("txn_c")).getByText("Success")).toBeInTheDocument(),
    );
  });
});

describe("retryReducer", () => {
  const empty: RetryStateMap = new Map();

  it("ignores RETRY_RESOLVED for a row that has already resolved", () => {
    // Defensive state-machine invariant: a RETRY_RESOLVED for an id no
    // longer in "retrying" is dropped, not applied. The current UI can't
    // double-resolve one id; this just keeps a late or duplicate
    // resolution from clobbering an already-recorded outcome.
    const after = retryReducer(
      retryReducer(
        retryReducer(empty, { type: "RETRY_STARTED", ids: ["txn_a"] }),
        { type: "RETRY_RESOLVED", id: "txn_a", status: "success" },
      ),
      { type: "RETRY_RESOLVED", id: "txn_a", status: "failed" },
    );
    expect(after.get("txn_a")).toBe("succeeded");
  });

  it("allows a fresh RETRY_STARTED to re-arm a row for a second outcome", () => {
    const afterFirstFail = retryReducer(
      retryReducer(empty, { type: "RETRY_STARTED", ids: ["txn_a"] }),
      { type: "RETRY_RESOLVED", id: "txn_a", status: "failed" },
    );
    const reArmed = retryReducer(afterFirstFail, {
      type: "RETRY_STARTED",
      ids: ["txn_a"],
    });
    const afterSecondSuccess = retryReducer(reArmed, {
      type: "RETRY_RESOLVED",
      id: "txn_a",
      status: "success",
    });
    expect(afterSecondSuccess.get("txn_a")).toBe("succeeded");
  });
});
