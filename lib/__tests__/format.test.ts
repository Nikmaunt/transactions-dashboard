import { describe, expect, it } from "vitest";
import { formatCurrency, formatDateTime } from "@/lib/format";

describe("formatCurrency", () => {
  it("renders USD with two decimals and locale separators", () => {
    expect(formatCurrency(1499, "USD")).toBe("$14.99");
    expect(formatCurrency(123456, "USD")).toBe("$1,234.56");
  });

  it("renders zero as $0.00, not $0", () => {
    expect(formatCurrency(0, "USD")).toBe("$0.00");
  });

  it("renders other currencies with their own symbol", () => {
    expect(formatCurrency(1000, "EUR")).toBe("€10.00");
    expect(formatCurrency(1000, "GBP")).toBe("£10.00");
  });
});

describe("formatDateTime", () => {
  it("renders an ISO UTC instant deterministically", () => {
    expect(formatDateTime("2026-05-12T08:14:00.000Z")).toMatch(
      /May 12, 2026, 08:14 UTC/,
    );
  });

  it("renders the seconds out (HH:MM only) and pads single-digit hours", () => {
    expect(formatDateTime("2026-01-02T03:04:05.000Z")).toMatch(
      /Jan 02, 2026, 03:04 UTC/,
    );
  });
});
