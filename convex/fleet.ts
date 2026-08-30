import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  AVG_SPEED_KMH,
  CO2_KG_PER_KM,
  DEPOT,
  OPERATING_COST_AED_PER_KM,
  roadKm,
} from "./geo";

/** Cadence of the simulated dispatch clock. */
const TICK_MS = 4000;

const PLATES = ["A 41287", "B 77310", "C 20945", "D 63118", "E 88402", "F 15736", "G 49521", "H 30684"];
const DRIVERS = [
  "Rashid Al Falasi",
  "Imran Qureshi",
  "Samuel Okoro",
  "Vinod Menon",
  "Hamza Yilmaz",
  "Daniel Reyes",
  "Karim Haddad",
  "Arun Nair",
];

/**
 * Turn the latest proven plan into a live fleet. One vehicle per route.
 * Distances come from the plan Devin produced; only the clock is simulated.
 */
export const dispatch = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const runs = await ctx.db
      .query("runs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(10);
    const run = runs.find((r) => r.status === "completed");
    if (!run) throw new Error("No completed consolidation to dispatch.");

    const existing = await ctx.db
      .query("vehicles")
      .withIndex("by_runId", (q) => q.eq("runId", run._id))
      .collect();
    for (const vRow of existing) await ctx.db.delete("vehicles", vRow._id);

    const routes = await ctx.db
      .query("routes")
      .withIndex("by_runId", (q) => q.eq("runId", run._id))
      .collect();
    const shipments = await ctx.db
      .query("shipments")
      .withIndex("by_runId", (q) => q.eq("runId", run._id))
      .collect();

    let i = 0;
    for (const r of routes) {
      // What these consignments would have cost on separate vans.
      const mine = shipments.filter((s) => r.shipmentRefs.includes(s.reference));
      const baselineKm = mine.reduce((acc, s) => {
        const o = { lat: s.originLat, lng: s.originLng };
        const d = { lat: s.destLat, lng: s.destLng };
        return acc + roadKm(DEPOT, o) + roadKm(o, d) + roadKm(d, DEPOT);
      }, 0);

      await ctx.db.insert("vehicles", {
        runId: run._id,
        routeId: r._id,
        label: r.label,
        plate: `DXB ${PLATES[i % PLATES.length]}`,
        driver: DRIVERS[i % DRIVERS.length],
        zone: r.zone,
        status: "en_route",
        stopsTotal: r.stopCount + 1, // pickups plus the drop
        stopsCompleted: 0,
        loadKg: r.loadKg,
        distanceKm: r.distanceKm,
        baselineKm: Math.round(baselineKm * 10) / 10,
        shipmentRefs: r.shipmentRefs,
        windowStart: r.windowStart,
        windowEnd: r.windowEnd,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      });
      i++;
    }

    await ctx.runMutation(internal.events.log, {
      runId: run._id,
      provider: "loadshare",
      type: "fleet.dispatched",
      message: `${routes.length} vehicles dispatched against the proven plan`,
    });

    await ctx.scheduler.runAfter(TICK_MS, internal.fleet.tick, {});
    return routes.length;
  },
});

/** Advances one stop on each moving vehicle, then reschedules itself. */
export const tick = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const moving = await ctx.db
      .query("vehicles")
      .withIndex("by_status", (q) => q.eq("status", "en_route"))
      .collect();
    if (moving.length === 0) return null;

    for (const vRow of moving) {
      const next = vRow.stopsCompleted + 1;
      const finished = next >= vRow.stopsTotal;
      await ctx.db.patch("vehicles", vRow._id, {
        stopsCompleted: Math.min(next, vRow.stopsTotal),
        status: finished ? "completed" : "en_route",
        updatedAt: Date.now(),
      });
      if (finished) {
        await ctx.runMutation(internal.events.log, {
          runId: vRow.runId,
          provider: "loadshare",
          type: "vehicle.completed",
          message: `${vRow.label} finished ${vRow.zone} (${vRow.stopsTotal} stops, ${vRow.distanceKm} km)`,
        });
      }
    }

    const stillMoving = moving.some(
      (m) => m.stopsCompleted + 1 < m.stopsTotal,
    );
    if (stillMoving) {
      await ctx.scheduler.runAfter(TICK_MS, internal.fleet.tick, {});
    }
    return null;
  },
});

export const reset = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const all = await ctx.db.query("vehicles").collect();
    for (const vRow of all) {
      await ctx.db.patch("vehicles", vRow._id, {
        stopsCompleted: 0,
        status: "en_route",
        startedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    if (all.length > 0) {
      await ctx.scheduler.runAfter(TICK_MS, internal.fleet.tick, {});
    }
    return all.length;
  },
});

/** Live fleet with per-vehicle savings derived from the stored plan. */
export const list = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const rows = await ctx.db.query("vehicles").collect();
    return rows
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((r) => {
        const kmSaved = Math.max(0, r.baselineKm - r.distanceKm);
        return {
          ...r,
          progress:
            r.stopsTotal > 0
              ? Math.round((r.stopsCompleted / r.stopsTotal) * 100)
              : 0,
          deliveriesTotal: r.shipmentRefs.length,
          deliveriesDone: Math.max(
            0,
            Math.min(
              r.shipmentRefs.length,
              r.stopsCompleted - 0 >= r.stopsTotal
                ? r.shipmentRefs.length
                : Math.floor(
                    (r.stopsCompleted / Math.max(1, r.stopsTotal)) *
                      r.shipmentRefs.length,
                  ),
            ),
          ),
          kmSaved: Math.round(kmSaved * 10) / 10,
          co2SavedKg: Math.round(kmSaved * CO2_KG_PER_KM * 10) / 10,
          costSavedAed: Math.round(kmSaved * OPERATING_COST_AED_PER_KM),
          minutesSaved: Math.round((kmSaved / AVG_SPEED_KMH) * 60),
          etaMinutes: Math.round((r.distanceKm / AVG_SPEED_KMH) * 60),
        };
      });
  },
});

export const counts = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const rows = await ctx.db.query("vehicles").collect();
    return {
      total: rows.length,
      enRoute: rows.filter((r) => r.status === "en_route").length,
      completed: rows.filter((r) => r.status === "completed").length,
      idle: rows.filter((r) => r.status === "idle").length,
    };
  },
});
