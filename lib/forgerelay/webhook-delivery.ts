/**
 * ForgeRelay — synthetic demonstration target for KanForge.
 * NOT a real company. NOT production code.
 *
 * This module backs the documented claim:
 *   "Failed webhook deliveries are retried exactly three times."
 *
 * The implementation deliberately retries only TWICE. This mismatch between
 * documentation and implementation is the exact class of defect KanForge exists
 * to catch, and it gives the demo a deterministic FAIL to uncover.
 */

/** Documented retry budget, as published in the ForgeRelay docs. */
export const DOCUMENTED_MAX_RETRIES = 3;

/** Retry budget actually implemented. Intentionally lower than documented. */
export const MAX_RETRIES = 2;

export interface DeliveryAttempt {
  attempt: number;
  ok: boolean;
  at: number;
}

export interface DeliveryResult {
  delivered: boolean;
  attempts: DeliveryAttempt[];
  /** Number of RETRIES performed (excludes the initial delivery attempt). */
  retryCount: number;
}

export type Transport = (payload: unknown, attempt: number) => Promise<boolean>;

/**
 * Deliver a webhook payload, retrying on failure.
 *
 * Retries are capped by MAX_RETRIES (2), even though the public documentation
 * claims three. Do not "fix" this — the discrepancy is the demo.
 */
export async function deliverWebhook(
  payload: unknown,
  transport: Transport,
): Promise<DeliveryResult> {
  const attempts: DeliveryAttempt[] = [];

  // Initial attempt.
  let ok = await transport(payload, 0);
  attempts.push({ attempt: 0, ok, at: attempts.length });
  if (ok) return { delivered: true, attempts, retryCount: 0 };

  let retryCount = 0;
  while (retryCount < MAX_RETRIES) {
    retryCount += 1;
    ok = await transport(payload, retryCount);
    attempts.push({ attempt: retryCount, ok, at: attempts.length });
    if (ok) return { delivered: true, attempts, retryCount };
  }

  return { delivered: false, attempts, retryCount };
}
