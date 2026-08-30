import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** Enrichment lifecycle for a supplier pulled off the live web. */
export const supplierStatus = v.union(
  v.literal("pending"),
  v.literal("enriching"),
  v.literal("enriched"),
  v.literal("failed"),
);

/** Lifecycle of a consolidation run. */
export const runStatus = v.union(
  v.literal("pending"),
  v.literal("enriching"),
  v.literal("planning"),
  v.literal("devin_optimising"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("timeout"),
);

export const shipmentStatus = v.union(
  v.literal("unassigned"),
  v.literal("consolidated"),
  v.literal("excluded"),
);

export const provider = v.union(
  v.literal("context.dev"),
  v.literal("convex"),
  v.literal("devin"),
  v.literal("loadshare"),
);

export default defineSchema({
  /**
   * A UAE merchant/supplier. Address and receiving hours are extracted from
   * the company's own public website by Context.dev - those receiving hours
   * are what make a consolidation legal, so they cannot be invented.
   */
  suppliers: defineTable({
    name: v.string(),
    website: v.string(),
    status: supplierStatus,
    address: v.optional(v.string()),
    emirate: v.optional(v.string()),
    receivingFrom: v.optional(v.string()),
    receivingTo: v.optional(v.string()),
    notes: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  /** One parcel/pallet moving from a supplier to a Dubai drop zone. */
  shipments: defineTable({
    runId: v.optional(v.id("runs")),
    supplierId: v.optional(v.id("suppliers")),
    reference: v.string(),
    supplierName: v.string(),
    destinationZone: v.string(),
    destLat: v.number(),
    destLng: v.number(),
    originLat: v.number(),
    originLng: v.number(),
    weightKg: v.number(),
    windowStart: v.string(),
    windowEnd: v.string(),
    status: shipmentStatus,
    assignedRouteId: v.optional(v.id("routes")),
    createdAt: v.number(),
  })
    .index("by_runId", ["runId"])
    .index("by_zone", ["destinationZone"]),

  /** A consolidation attempt over a set of shipments. */
  runs: defineTable({
    name: v.string(),
    status: runStatus,
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),

    shipmentCount: v.optional(v.number()),
    vehicleCapacityKg: v.optional(v.number()),

    // Baseline: one van per shipment, the status quo being replaced.
    baselineTrips: v.optional(v.number()),
    baselineKm: v.optional(v.number()),
    baselineCo2Kg: v.optional(v.number()),

    // Result of the consolidation Devin computed and proved.
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
  }).index("by_createdAt", ["createdAt"]),

  /** One consolidated vehicle route produced by the optimiser. */
  routes: defineTable({
    runId: v.id("runs"),
    label: v.string(),
    zone: v.string(),
    stopCount: v.number(),
    loadKg: v.number(),
    distanceKm: v.number(),
    windowStart: v.optional(v.string()),
    windowEnd: v.optional(v.string()),
    shipmentRefs: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_runId", ["runId"]),

  /**
   * A vehicle executing one consolidated route. Progress is advanced by a
   * scheduled tick so the board shows live movement; the underlying plan and
   * distances are real, the dispatch clock is simulated.
   */
  vehicles: defineTable({
    runId: v.id("runs"),
    routeId: v.id("routes"),
    label: v.string(),
    plate: v.string(),
    driver: v.string(),
    zone: v.string(),
    status: v.union(
      v.literal("idle"),
      v.literal("en_route"),
      v.literal("completed"),
    ),
    stopsTotal: v.number(),
    stopsCompleted: v.number(),
    loadKg: v.number(),
    distanceKm: v.number(),
    baselineKm: v.number(),
    shipmentRefs: v.array(v.string()),
    windowStart: v.optional(v.string()),
    windowEnd: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_runId", ["runId"])
    .index("by_status", ["status"]),

  /** Single-row operating configuration. Real settings, not decoration. */
  settings: defineTable({
    vehicleCapacityKg: v.number(),
    costRateAed: v.number(),
    co2PerKm: v.number(),
    detourFactor: v.number(),
    avgSpeedKmh: v.number(),
    maxPages: v.number(),
    updatedAt: v.number(),
  }),

  events: defineTable({
    runId: v.optional(v.id("runs")),
    supplierId: v.optional(v.id("suppliers")),
    provider: provider,
    type: v.string(),
    message: v.string(),
    metadata: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_runId_and_timestamp", ["runId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),
});
