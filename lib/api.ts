import type { RetryResult } from "./types";

export async function retryTransaction(id: string): Promise<RetryResult> {
  const response = await fetch(`/api/transactions/${id}/retry`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Retry failed for ${id}: ${response.status}`);
  }
  return (await response.json()) as RetryResult;
}

export async function downloadInvoiceBlob(id: string): Promise<Blob> {
  const response = await fetch(`/api/transactions/${id}/invoice`);
  if (!response.ok) {
    throw new Error(`Invoice download failed for ${id}: ${response.status}`);
  }
  return await response.blob();
}
