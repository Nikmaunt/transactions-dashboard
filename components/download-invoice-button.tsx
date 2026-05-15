"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadInvoiceBlob } from "@/lib/api";

export function DownloadInvoiceButton({
  transactionId,
}: {
  transactionId: string;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
    setIsGenerating(true);
    try {
      const blob = await downloadInvoiceBlob(transactionId);
      triggerBrowserDownload(blob, `invoice-${transactionId}.txt`);
      toast.success("Invoice downloaded", {
        description: `Saved invoice for ${transactionId}.`,
      });
    } catch {
      toast.error("Could not generate invoice", {
        description: "Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={isGenerating}
        aria-label={
          isGenerating
            ? `Generating invoice for ${transactionId}`
            : `Download invoice for ${transactionId}`
        }
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isGenerating ? (
          <>
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Download aria-hidden className="h-3.5 w-3.5" />
            Invoice
          </>
        )}
      </button>
      {isGenerating ? (
        <span role="status" className="sr-only">
          Generating invoice for {transactionId}
        </span>
      ) : null}
    </>
  );
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
