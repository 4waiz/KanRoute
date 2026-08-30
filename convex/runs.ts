import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { DEPOT, roadKm, zoneCoords } from "./geo";
import { runStatus } from "./schema";

/**
 * Synthetic consignment pattern, per event rules on test data. Each entry is
 * (destination zone, weight kg). Suppliers are attached round-robin from the
 * live Context.dev enrichment, so pickup windows are real even though the
 * parcels are invented.
 */
const DEMO_LOAD: { zone: string; weightKg: number }[] = [
  { zone: "Jumeirah Lake Towers", weightKg: 180 },
  { zone: "Jumeirah Lake Towers", weightKg: 240 },
  { zone: "Jumeirah Lake Towers", weightKg: 310 },
  { zone: "Dubai Marina", weightKg: 205 },
  { zone: "Dubai Marina", weightKg: 165 },
  { zone: "Dubai Marina", weightKg: 350 },
  { zone: "Business Bay", weightKg: 260 },
  { zone: "Business Bay", weightKg: 190 },
  { zone: "Business Bay", weightKg: 420 },
  { zone: "DIFC", weightKg: 150 },
  { zone: "DIFC", weightKg: 220 },
  { zone: "DIFC", weightKg: 275 },
  { zone: "Deira", weightKg: 380 },
  { zone: "Deira", weightKg: 290 },
  { zone: "Deira", weightKg: 210 },
  { zone: "Downtown Dubai", weightKg: 330 },
  { zone: "Downtown Dubai", weightKg: 145 },
  { zone: "Downtown Dubai", weightKg: 260 },
  { zone: "Dubai Silicon Oasis", weightKg: 340 },
  { zone: "Dubai Silicon Oasis", weightKg: 260 },
  { zone: "Dubai Silicon Oasis", weightKg: 195 },
  { zone: "Mirdif", weightKg: 285 },
  { zone: "Mirdif", weightKg: 175 },
  { zone: "Mirdif", weightKg: 320 },
];

export const create = mutation({
  args: { name: v.optional(v.string()) },
  returns: v.id("runs"),
  handler: async (ctx, { name }): Promise<Id<"runs">> => {
    const suppliers = await ctx.db.query("suppliers").collect();
    // Only suppliers we could both enrich and place on the map can be routed.
    const usable = suppliers.filter(
      (s) => s.status === "enriched" && s.lat != null && s.lng != null,
    );
    if (usable.length === 0) {
      throw new Error(
        "No mappable suppliers yet. Context.dev is still reading supplier sites.",
      );
    }

    const cfg: {
      vehicleCapacityKg: number;
      co2PerKm: number;
    } = await ctx.runQuery(internal.settings.getInternal, {});

    const runId: Id<"runs"> = await ctx.db.insert("runs", {
      name: name ?? "Dubai consolidation run",
      status: "planning",
      createdAt: Date.now(),
      vehicleCapacityKg: cfg.vehicleCapacityKg,
    });

    let baselineKm = 0;
    for (let i = 0; i < DEMO_LOAD.length; i++) {
      const load = DEMO_LOAD[i];
      const supplier = usable[i % usable.length];
      const origin = { lat: supplier.lat as number, lng: supplier.lng as number };
      const dest = zoneCoords(load.zone);

      // Status quo: a dedicated van per consignment.
      baselineKm +=
        roadKm(DEPOT, origin) + roadKm(origin, dest) + roadKm(dest, DEPOT);

      await ctx.db.insert("shipments", {
        runId,
        supplierId: supplier._id,
        reference: `SHP-${String(i + 1).padStart(3, "0")}`,
        supplierName: supplier.name,
        destinationZone: load.zone,
        destLat: dest.lat,
        destLng: dest.lng,
        originLat: origin.lat,
        originLng: origin.lng,
        weightKg: load.weightKg,
        windowStart: supplier.receivingFrom ?? "08:00",
        windowEnd: supplier.receivingTo ?? "18:00",
        status: "unassigned",
        createdAt: Date.now(),
      });
    }

    await ctx.db.patch("runs", runId, {
      shipmentCount: DEMO_LOAD.length,
      baselineTrips: DEMO_LOAD.length,
      baselineKm: Math.round(baselineKm * 10) / 10,
      baselineCo2Kg: Math.round(baselineKm * cfg.co2PerKm * 10) / 10,
    });

    await ctx.runMutation(internal.events.log, {
      runId,
      provider: "convex",
      type: "run.created",
      message: `${DEMO_LOAD.length} consignments staged, baseline ${Math.round(baselineKm)} km on ${DEMO_LOAD.length} separate vans`,
    });

    await ctx.scheduler.runAfter(0, internal.optimiser.startSession, { runId });
    return runId;
  },
});

export const patchRun = internalMutation({
  args: {
    runId: v.id("runs"),
    status: v.optional(runStatus),
    error: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    routeCount: v.optional(v.number()),
    consolidatedKm: v.optional(v.number()),
    consolidatedCo2Kg: v.optional(v.number()),
    devinSessionId: v.optional(v.string()),
    devinSessionUrl: v.optional(v.string()),
    devinStatus: v.optional(v.string()),
    devinStatusDetail: v.optional(v.string()),
    nudgeSent: v.optional(v.boolean()),
    pollCount: v.optional(v.number()),
    lastPolledAt: v.optional(v.number()),
    feasible: v.optional(v.boolean()),
    proofOutput: v.optional(v.string()),
    optimiserCode: v.optional(v.string()),
    rawResult: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { runId, ...patch }) => {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch("runs", runId, clean);
    return null;
  },
});

export const saveRoutes = internalMutation({
  args: {
    runId: v.id("runs"),
    routes: v.array(
      v.object({
        label: v.string(),
        zone: v.string(),
        stopCount: v.number(),
        loadKg: v.number(),
        distanceKm: v.number(),
        windowStart: v.optional(v.string()),
        windowEnd: v.optional(v.string()),
        shipmentRefs: v.array(v.string()),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, { runId, routes }) => {
    const existing = await ctx.db
      .query("routes")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .collect();
    for (const r of existing) await ctx.db.delete("routes", r._id);

    const shipments = await ctx.db
      .query("shipments")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .collect();

    for (const r of routes) {
      const routeId: Id<"routes"> = await ctx.db.insert("routes", {
        runId,
        ...r,
        createdAt: Date.now(),
      });
      for (const ref of r.shipmentRefs) {
        const s = shipments.find((x) => x.reference === ref);
        if (s) {
          await ctx.db.patch("shipments", s._id, {
            status: "consolidated",
            assignedRouteId: routeId,
          });
        }
      }
    }
    return routes.length;
  },
});

export const getInternal = internalQuery({
  args: { runId: v.id("runs") },
  returns: v.any(),
  handler: async (ctx, { runId }) => ctx.db.get("runs", runId),
});

export const shipmentsForRunInternal = internalQuery({
  args: { runId: v.id("runs") },
  returns: v.array(v.any()),
  handler: async (ctx, { runId }) =>
    ctx.db
      .query("shipments")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .collect(),
});

export const get = query({
  args: { runId: v.id("runs") },
  returns: v.any(),
  handler: async (ctx, { runId }) => ctx.db.get("runs", runId),
});

export const latest = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("runs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(1);
    return rows[0] ?? null;
  },
});

export const shipments = query({
  args: { runId: v.id("runs") },
  returns: v.array(v.any()),
  handler: async (ctx, { runId }) =>
    ctx.db
      .query("shipments")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .collect(),
});

export const routes = query({
  args: { runId: v.id("runs") },
  returns: v.array(v.any()),
  handler: async (ctx, { runId }) =>
    ctx.db
      .query("routes")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .collect(),
});
