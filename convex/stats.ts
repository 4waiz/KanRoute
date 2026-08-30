import { v } from "convex/values";
import { query } from "./_generated/server";


/**
 * Fleet-wide aggregates across every completed consolidation.
 * All figures are derived from stored run results, never hard-coded.
 */
export const summary = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const cfgRow = await ctx.db.query("settings").first();
    const CO2_KG_PER_KM = cfgRow?.co2PerKm ?? 0.25;
    const OPERATING_COST_AED_PER_KM = cfgRow?.costRateAed ?? 2.2;

    const runs = await ctx.db.query("runs").collect();
    const completed = runs.filter((r) => r.status === "completed");
    const routes = await ctx.db.query("routes").collect();
    const suppliers = await ctx.db.query("suppliers").collect();

    const completedIds = new Set(completed.map((r) => r._id));
    const liveRoutes = routes.filter((r) => completedIds.has(r.runId));

    const baselineKm = completed.reduce((a, r) => a + (r.baselineKm ?? 0), 0);
    const consolidatedKm = completed.reduce(
      (a, r) => a + (r.consolidatedKm ?? 0),
      0,
    );
    const kmSaved = Math.max(0, baselineKm - consolidatedKm);

    const baselineVans = completed.reduce((a, r) => a + (r.baselineTrips ?? 0), 0);
    const usedVans = completed.reduce((a, r) => a + (r.routeCount ?? 0), 0);
    const consignments = completed.reduce(
      (a, r) => a + (r.shipmentCount ?? 0),
      0,
    );

    // Utilisation per route against the vehicle capacity of its run.
    const capacityByRun = new Map(
      completed.map((r) => [r._id, r.vehicleCapacityKg ?? 1200]),
    );
    const utilisations = liveRoutes.map((r) => {
      const cap = capacityByRun.get(r.runId) ?? 1200;
      return cap > 0 ? r.loadKg / cap : 0;
    });
    const avgUtil =
      utilisations.length > 0
        ? utilisations.reduce((a, b) => a + b, 0) / utilisations.length
        : 0;

    const buckets = [
      { label: "0-20%", count: 0 },
      { label: "21-40%", count: 0 },
      { label: "41-60%", count: 0 },
      { label: "61-80%", count: 0 },
      { label: "81-100%", count: 0 },
    ];
    for (const u of utilisations) {
      const pct = u * 100;
      const idx =
        pct <= 20 ? 0 : pct <= 40 ? 1 : pct <= 60 ? 2 : pct <= 80 ? 3 : 4;
      buckets[idx].count += 1;
    }

    const stopsPerRoute =
      liveRoutes.length > 0
        ? liveRoutes.reduce((a, r) => a + r.stopCount, 0) / liveRoutes.length
        : 0;

    const feasibleRuns = completed.filter((r) => r.feasible === true).length;

    const recent = completed
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map((r) => {
        const rr = liveRoutes.filter((x) => x.runId === r._id);
        const cap = r.vehicleCapacityKg ?? 1200;
        const util =
          rr.length > 0
            ? rr.reduce((a, x) => a + x.loadKg / cap, 0) / rr.length
            : 0;
        return {
          id: r._id,
          name: r.name,
          createdAt: r.createdAt,
          routeCount: r.routeCount ?? 0,
          shipmentCount: r.shipmentCount ?? 0,
          baselineKm: r.baselineKm ?? 0,
          consolidatedKm: r.consolidatedKm ?? 0,
          kmSaved: Math.round(((r.baselineKm ?? 0) - (r.consolidatedKm ?? 0)) * 10) / 10,
          co2Saved:
            Math.round(((r.baselineCo2Kg ?? 0) - (r.consolidatedCo2Kg ?? 0)) * 10) /
            10,
          utilisation: Math.round(util * 100),
          feasible: r.feasible === true,
          devinSessionUrl: r.devinSessionUrl,
        };
      });

    return {
      runsCompleted: completed.length,
      runsTotal: runs.length,
      suppliersMapped: suppliers.filter(
        (s) => s.status === "enriched" && s.lat != null,
      ).length,
      suppliersTotal: suppliers.length,
      consignments,
      baselineVans,
      usedVans,
      vansSaved: Math.max(0, baselineVans - usedVans),
      baselineKm: Math.round(baselineKm * 10) / 10,
      consolidatedKm: Math.round(consolidatedKm * 10) / 10,
      kmSaved: Math.round(kmSaved * 10) / 10,
      kmSavedPct: baselineKm > 0 ? Math.round((kmSaved / baselineKm) * 100) : 0,
      co2SavedKg: Math.round(kmSaved * CO2_KG_PER_KM * 10) / 10,
      costSavedAed: Math.round(kmSaved * OPERATING_COST_AED_PER_KM),
      costRateAed: OPERATING_COST_AED_PER_KM,
      avgUtilisation: Math.round(avgUtil * 100),
      utilisationBuckets: buckets,
      stopsPerRoute: Math.round(stopsPerRoute * 10) / 10,
      feasibleRuns,
      feasiblePct:
        completed.length > 0
          ? Math.round((feasibleRuns / completed.length) * 100)
          : 0,
      recent,
    };
  },
});
