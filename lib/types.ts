export type TransactionStatus = "success" | "failed" | "pending" | "refunded";

export type Currency = "USD" | "EUR" | "GBP";

export type Transaction = {
  id: string;
  description: string;
  amountCents: number;
  currency: Currency;
  occurredAt: string;
  status: TransactionStatus;
};

export type RetryOutcome = "success" | "failed";

export type RetryResult = {
  id: string;
  status: RetryOutcome;
};
