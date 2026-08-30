import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction } from "./_generated/server";
import { CO2_KG_PER_KM, DEPOT } from "./geo";

const DEVIN_BASE = "https://api.devin.ai/v3";

/** Bounded orchestration: never poll or nudge forever. */
const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 40; // ~10 minutes
const MAX_ACU_LIMIT = 4;

/**
 * Devin must return a plan AND the output of actually running its own
 * feasibility check, so the numbers on screen are computed, not asserted.
 */
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    routes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          zone: { type: "string" },
          shipmentRefs: { type: "array", items: { type: "string" } },
          loadKg: { type: "number" },
          distanceKm: { type: "number" },
          windowStart: { type: "string" },
          windowEnd: { type: "string" },
        },
        required: ["label", "zone", "shipmentRefs", "loadKg", "distanceKm"],
      },
    },
    totalDistanceKm: { type: "number" },
    feasible: { type: "boolean" },
    proofOutput: {
      type: "string",
      description:
        "Verbatim stdout from running the constraint checker, showing each route passing capacity and time-window checks.",
    },
    optimiserCode: {
      type: "string",
      description: "The optimiser source you wrote and executed.",
    },
    notes: { type: "string" },
  },
  required: ["routes", "totalDistanceKm", "feasible", "proofOutput"],
};

function buildPrompt(args: {
  shipments: {
    reference: string;
    supplierName: string;
    destinationZone: string;
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    weightKg: number;
    windowStart: string;
    windowEnd: string;
  }[];
  capacityKg: number;
}) {
  const rows = args.shipments
    .map(
      (s) =>
        `${s.reference} | supplier=${s.supplierName} | pickup=(${s.originLat.toFixed(4)},${s.originLng.toFixed(4)}) | pickupWindow=${s.windowStart}-${s.windowEnd} | dropZone=${s.destinationZone} | drop=(${s.destLat.toFixed(4)},${s.destLng.toFixed(4)}) | weightKg=${s.weightKg}`,
    )
    .join("\n");

  return [
    "You are the routing engine for LoadShare UAE, a last-mile consolidation",
    "service operating in Dubai.",
    "",
    "Today every consignment below is moving on its own van. Your job is to",
    "consolidate them into as few vehicle routes as possible, then PROVE the",
    "plan is feasible by executing a constraint checker.",
    "",
    `Depot: ${DEPOT.name} at (${DEPOT.lat}, ${DEPOT.lng}).`,
    `Vehicle capacity: ${args.capacityKg} kg.`,
    "",
    "Consignments:",
    rows,
    "",
    "Rules for a valid route:",
    "1. A route starts at the depot, collects from each assigned supplier,",
    "   delivers to the drop zone, and returns to the depot.",
    "2. Total load on a route must not exceed vehicle capacity.",
    "3. All pickups on a route must share an overlapping pickup window; the",
    "   route window is the intersection and must be at least 60 minutes.",
    "4. Only consolidate consignments sharing the same drop zone.",
    "5. Every consignment must appear in exactly one route. None may be dropped.",
    "",
    "Method:",
    "- Write an optimiser in Python or TypeScript in your workspace.",
    "- Compute distances with the haversine formula multiplied by a 1.35 urban",
    "  detour factor, so results are comparable to the baseline.",
    "- Then write and RUN a separate constraint checker that asserts rules 2-5",
    "  for every route and prints a per-route PASS/FAIL line plus totals.",
    "- Capture the checker's real stdout. Do not paraphrase it.",
    "",
    "Do not modify or push to any repository. Work only in your own workspace.",
    "Never invent output: proofOutput must be what the checker actually printed.",
    "",
    "When finished you MUST call the provide_structured_output tool with",
    "is_final=true using the required schema.",
  ].join("\n");
}

export const startSession = internalAction({
  args: { runId: v.id("runs") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.runQuery(internal.runs.getInternal, { runId });
    if (!run) return null;

    const shipments = await ctx.runQuery(internal.runs.shipmentsForRunInternal, {
      runId,
    });

    const key = process.env.DEVIN_API_KEY;
    const org = process.env.DEVIN_ORG_ID;
    if (!key || !org) {
      await fail(ctx, runId, "Devin credentials are not configured.");
      return null;
    }

    await ctx.runMutation(internal.runs.patchRun, {
      runId,
      status: "devin_optimising",
      nudgeSent: false,
      pollCount: 0,
    });
    await ctx.runMutation(internal.events.log, {
      runId,
      provider: "loadshare",
      type: "optimise.queued",
      message: `Handing ${shipments.length} consignments to Devin for routing`,
    });

    try {
      const res = await fetch(`${DEVIN_BASE}/organizations/${org}/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: buildPrompt({
            shipments,
            capacityKg: run.vehicleCapacityKg ?? 1200,
          }),
          structured_output_schema: RESULT_SCHEMA,
          structured_output_required: true,
          max_acu_limit: MAX_ACU_LIMIT,
          resumable: false,
          tags: ["loadshare-uae"],
          title: `LoadShare consolidation: ${shipments.length} consignments`,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        await fail(
          ctx,
          runId,
          `Devin session creation failed (${res.status}): ${text.slice(0, 180)}`,
        );
        return null;
      }

      const body = JSON.parse(text) as { session_id: string; url: string };
      await ctx.runMutation(internal.runs.patchRun, {
        runId,
        devinSessionId: body.session_id,
        devinSessionUrl: body.url,
      });
      await ctx.runMutation(internal.events.log, {
        runId,
        provider: "devin",
        type: "session.created",
        message: `Devin session created: ${body.session_id}`,
        metadata: JSON.stringify({ url: body.url }),
      });

      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        internal.optimiser.pollSession,
        { runId },
      );
    } catch (err) {
      await fail(ctx, runId, err instanceof Error ? err.message : String(err));
    }
    return null;
  },
});

export const pollSession = internalAction({
  args: { runId: v.id("runs") },
  returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.runQuery(internal.runs.getInternal, { runId });
    if (!run || !run.devinSessionId) return null;
    if (["completed", "failed", "timeout"].includes(run.status)) return null;

    const key = process.env.DEVIN_API_KEY!;
    const org = process.env.DEVIN_ORG_ID!;
    const pollCount = (run.pollCount ?? 0) + 1;

    if (pollCount > MAX_POLLS) {
      await ctx.runMutation(internal.runs.patchRun, {
        runId,
        status: "timeout",
        completedAt: Date.now(),
        error: "Devin exceeded the optimisation time budget.",
      });
      await ctx.runMutation(internal.events.log, {
        runId,
        provider: "loadshare",
        type: "optimise.timeout",
        message: "Optimisation timed out.",
      });
      return null;
    }

    const res = await fetch(
      `${DEVIN_BASE}/organizations/${org}/sessions/${run.devinSessionId}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) {
      await ctx.runMutation(internal.runs.patchRun, {
        runId,
        pollCount,
        lastPolledAt: Date.now(),
      });
      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        internal.optimiser.pollSession,
        { runId },
      );
      return null;
    }

    const session = (await res.json()) as {
      status?: string;
      status_detail?: string;
      structured_output?: Record<string, unknown> | null;
    };

    await ctx.runMutation(internal.runs.patchRun, {
      runId,
      pollCount,
      lastPolledAt: Date.now(),
      devinStatus: session.status,
      devinStatusDetail: session.status_detail,
    });

    const output = session.structured_output;
    if (output && Object.keys(output).length > 0) {
      await finish(ctx, runId, run.baselineKm ?? 0, output);
      return null;
    }

    const stalled =
      session.status_detail === "waiting_for_user" ||
      session.status === "exit" ||
      session.status === "suspended";

    // Verified in prep: structured_output_required does not reliably force
    // output. One bounded nudge, then give up rather than loop.
    if (stalled && !run.nudgeSent) {
      await ctx.runMutation(internal.runs.patchRun, { runId, nudgeSent: true });
      await ctx.runMutation(internal.events.log, {
        runId,
        provider: "loadshare",
        type: "devin.nudged",
        message: "Devin stalled without structured output, sending one follow-up.",
      });
      await fetch(
        `${DEVIN_BASE}/organizations/${org}/sessions/${run.devinSessionId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message:
              "Call the provide_structured_output tool now using the requested schema with is_final=true. Do not provide only a chat response. Finish after submitting structured output.",
          }),
        },
      );
      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        internal.optimiser.pollSession,
        { runId },
      );
      return null;
    }

    if (stalled && run.nudgeSent) {
      await fail(ctx, runId, "Devin ended without returning a routing plan.");
      return null;
    }

    await ctx.scheduler.runAfter(
      POLL_INTERVAL_MS,
      internal.optimiser.pollSession,
      { runId },
    );
    return null;
  },
});

async function finish(
  ctx: ActionCtx,
  runId: Id<"runs">,
  baselineKm: number,
  output: Record<string, unknown>,
) {
  const rawRoutes = Array.isArray(output.routes)
    ? (output.routes as Record<string, unknown>[])
    : [];

  const routes = rawRoutes.map((r, i) => ({
    label: String(r.label ?? `Route ${i + 1}`),
    zone: String(r.zone ?? "Unknown"),
    stopCount: Array.isArray(r.shipmentRefs) ? r.shipmentRefs.length : 0,
    loadKg: Number(r.loadKg ?? 0),
    distanceKm: Math.round(Number(r.distanceKm ?? 0) * 10) / 10,
    windowStart: r.windowStart ? String(r.windowStart) : undefined,
    windowEnd: r.windowEnd ? String(r.windowEnd) : undefined,
    shipmentRefs: Array.isArray(r.shipmentRefs)
      ? r.shipmentRefs.map((x) => String(x))
      : [],
  }));

  await ctx.runMutation(internal.runs.saveRoutes, { runId, routes });

  const totalKm = Math.round(Number(output.totalDistanceKm ?? 0) * 10) / 10;
  await ctx.runMutation(internal.runs.patchRun, {
    runId,
    status: "completed",
    completedAt: Date.now(),
    routeCount: routes.length,
    consolidatedKm: totalKm,
    consolidatedCo2Kg: Math.round(totalKm * CO2_KG_PER_KM * 10) / 10,
    feasible: Boolean(output.feasible),
    proofOutput: output.proofOutput ? String(output.proofOutput) : undefined,
    optimiserCode: output.optimiserCode
      ? String(output.optimiserCode).slice(0, 20000)
      : undefined,
    rawResult: JSON.stringify(output, null, 2).slice(0, 60000),
  });

  const saved = Math.max(0, baselineKm - totalKm);
  await ctx.runMutation(internal.events.log, {
    runId,
    provider: "devin",
    type: "optimise.completed",
    message: `Plan returned: ${routes.length} routes, ${totalKm} km (saves ${Math.round(saved)} km)`,
  });
  await ctx.runMutation(internal.events.log, {
    runId,
    provider: "convex",
    type: "routes.persisted",
    message: `${routes.length} consolidated routes persisted`,
  });
}

async function fail(ctx: ActionCtx, runId: Id<"runs">, message: string) {
  await ctx.runMutation(internal.runs.patchRun, {
    runId,
    status: "failed",
    completedAt: Date.now(),
    error: message,
  });
  await ctx.runMutation(internal.events.log, {
    runId,
    provider: "devin",
    type: "optimise.failed",
    message: message.slice(0, 240),
  });
}

/** Read-only probe for the integration health indicators. */
export const health = action({
  args: {},
  returns: v.any(),
  handler: async () => {
    const key = process.env.DEVIN_API_KEY;
    const org = process.env.DEVIN_ORG_ID;
    if (!key || !org) return { ok: false, reason: "not configured" };
    const res = await fetch(`${DEVIN_BASE}/self`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    return { ok: res.ok, status: res.status };
  },
});
