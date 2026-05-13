import { NextResponse } from "next/server";
import { findTransaction } from "@/lib/server/store";
import { delay } from "@/lib/server/delay";

const INVOICE_GENERATION_MS = 2000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const transaction = findTransaction(id);
  if (!transaction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await delay(INVOICE_GENERATION_MS);

  const body = renderInvoice(transaction);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoice-${transaction.id}.txt"`,
      "Cache-Control": "no-store",
    },
  });
}

function renderInvoice(t: {
  id: string;
  description: string;
  amountCents: number;
  currency: string;
  occurredAt: string;
  status: string;
}): string {
  const amount = (t.amountCents / 100).toFixed(2);
  return [
    "STREAMSERVICE — INVOICE",
    "",
    `Transaction ID : ${t.id}`,
    `Date           : ${t.occurredAt}`,
    `Description    : ${t.description}`,
    `Amount         : ${amount} ${t.currency}`,
    `Status         : ${t.status}`,
    "",
    "This document is a mock invoice generated for demonstration purposes.",
  ].join("\n");
}
