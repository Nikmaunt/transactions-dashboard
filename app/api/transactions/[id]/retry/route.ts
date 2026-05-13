import { NextResponse } from "next/server";
import { findTransaction, markRetrySucceeded } from "@/lib/server/store";
import { randomDelay } from "@/lib/server/delay";
import type { RetryResult } from "@/lib/types";

const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 4000;
const FAILURE_RATE = 0.2;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const transaction = findTransaction(id);
  if (!transaction) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (transaction.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed transactions can be retried" },
      { status: 409 },
    );
  }

  await randomDelay(RETRY_MIN_MS, RETRY_MAX_MS);

  const succeeded = Math.random() >= FAILURE_RATE;
  if (succeeded) markRetrySucceeded(id);

  const result: RetryResult = { id, status: succeeded ? "success" : "failed" };
  return NextResponse.json(result);
}
