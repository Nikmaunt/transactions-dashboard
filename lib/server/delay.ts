import "server-only";

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  return delay(ms);
}
