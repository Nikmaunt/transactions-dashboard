import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Toaster } from "sonner";
import { DownloadInvoiceButton } from "@/components/download-invoice-button";
import { server } from "@/test/msw/server";
import { deferred } from "@/test/helpers/deferred";

const createObjectURL = vi.fn((): string => "blob:fake-url");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
  });
});

afterEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

function renderButton(id = "txn_001") {
  return render(
    <>
      <DownloadInvoiceButton transactionId={id} />
      <Toaster />
    </>,
  );
}

describe("DownloadInvoiceButton", () => {
  it("shows a Generating state while the invoice is being generated", async () => {
    const gate = deferred<void>();
    server.use(
      http.get("/api/transactions/:id/invoice", async () => {
        await gate.promise;
        return new HttpResponse("invoice body", {
          headers: { "Content-Type": "text/plain" },
        });
      }),
    );

    const user = userEvent.setup();
    renderButton("txn_001");

    await user.click(screen.getByRole("button", { name: /download invoice/i }));

    expect(
      screen.getByRole("button", { name: /generating invoice for txn_001/i }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      /generating invoice for txn_001/i,
    );

    gate.resolve();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /download invoice for txn_001/i }),
      ).toBeEnabled(),
    );
  });

  it("triggers a browser download and shows a success toast", async () => {
    server.use(
      http.get("/api/transactions/:id/invoice", () =>
        new HttpResponse("invoice body", {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === "a") {
          (el as HTMLAnchorElement).click = clickSpy;
        }
        return el;
      });

    const user = userEvent.setup();
    renderButton("txn_001");

    await user.click(screen.getByRole("button", { name: /download invoice/i }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
    expect(await screen.findByText(/invoice downloaded/i)).toBeInTheDocument();

    createElementSpy.mockRestore();
  });

  it("shows an error toast when the request fails", async () => {
    server.use(
      http.get("/api/transactions/:id/invoice", () =>
        new HttpResponse(null, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderButton("txn_001");

    await user.click(screen.getByRole("button", { name: /download invoice/i }));

    expect(
      await screen.findByText(/could not generate invoice/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download invoice for txn_001/i }),
    ).toBeEnabled();
  });
});
