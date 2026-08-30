import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import {
  AVG_SPEED_KMH,
  CO2_KG_PER_KM,
  DETOUR_FACTOR,
  OPERATING_COST_AED_PER_KM,
} from "./geo";

export const DEFAULTS = {
  vehicleCapacityKg: 1200,
  costRateAed: OPERATING_COST_AED_PER_KM,
  co2PerKm: CO2_KG_PER_KM,
  detourFactor: DETOUR_FACTOR,
  avgSpeedKmh: AVG_SPEED_KMH,
  maxPages: 6,
};

/** Reads the single settings row, falling back to documented defaults. */
export const get = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const row = await ctx.db.query("settings").first();
    return row ?? { ...DEFAULTS, _id: null };
  },
});

export const getInternal = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const row = await ctx.db.query("settings").first();
    return row ?? DEFAULTS;
  },
});

export const update = mutation({
  args: {
    vehicleCapacityKg: v.number(),
    costRateAed: v.number(),
    co2PerKm: v.number(),
    detourFactor: v.number(),
    avgSpeedKmh: v.number(),
    maxPages: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Guard rails so a typo cannot produce nonsense savings figures.
    const clean = {
      vehicleCapacityKg: clamp(args.vehicleCapacityKg, 200, 26000),
      costRateAed: clamp(args.costRateAed, 0.1, 50),
      co2PerKm: clamp(args.co2PerKm, 0.01, 5),
      detourFactor: clamp(args.detourFactor, 1, 3),
      avgSpeedKmh: clamp(args.avgSpeedKmh, 5, 120),
      maxPages: Math.round(clamp(args.maxPages, 1, 50)),
      updatedAt: Date.now(),
    };
    const row = await ctx.db.query("settings").first();
    if (row) await ctx.db.patch("settings", row._id, clean);
    else await ctx.db.insert("settings", clean);
    return null;
  },
});

export const reset = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const row = await ctx.db.query("settings").first();
    if (row) await ctx.db.delete("settings", row._id);
    return null;
  },
});

function clamp(n: number, lo: number, hi: number) {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}
