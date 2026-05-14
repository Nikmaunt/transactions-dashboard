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
// jsdom does not implement HTMLAnchorElement.click; without a stub it
// logs "Not implemented: navigation to another Document" to stderr
// whenever triggerBrowserDownload fires. Stub the prototype once so
// every test stays quiet, and let individual tests assert against it.
let anchorClickSpy: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
  });
  anchorClickSpy = vi.fn<() => void>();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    anchorClickSpy,
  );
});

afterEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.restoreAllMocks();
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

    const user = userEvent.setup();
    renderButton("txn_001");

    await user.click(screen.getByRole("button", { name: /download invoice/i }));

    await waitFor(() => expect(anchorClickSpy).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
    expect(await screen.findByText(/invoice downloaded/i)).toBeInTheDocument();
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
