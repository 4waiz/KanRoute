/**
 * ForgeRelay - synthetic demonstration target for KanForge.
 *
 * Backs the documented claim:
 *   "GET /api/demo/health returns an OK status and the current API version."
 *
 * Implemented correctly, so KanForge should return PASS.
 */
import { NextResponse } from "next/server";

export const API_VERSION = "2026-08-01";

export function GET() {
  return NextResponse.json({
    status: "ok",
    version: API_VERSION,
    service: "forgerelay-demo",
    uptime: "operational",
  });
}
