/**
 * ForgeRelay — synthetic demonstration target for KanForge.
 * NOT a real company. NOT production code.
 *
 * Backs the documented claim:
 *   "Every webhook request is signed with an HMAC SHA-256 signature."
 *
 * This one is implemented correctly, so KanForge should return PASS.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-forgerelay-signature";
export const SIGNATURE_ALGORITHM = "sha256";

/** Produce the hex HMAC-SHA256 signature for a raw webhook body. */
export function signPayload(rawBody: string, secret: string): string {
  return createHmac(SIGNATURE_ALGORITHM, secret).update(rawBody).digest("hex");
}

/** Constant-time verification of a webhook signature. */
export function verifySignature(
  rawBody: string,
  secret: string,
  provided: string,
): boolean {
  const expected = signPayload(rawBody, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
