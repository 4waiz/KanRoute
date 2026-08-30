import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

/**
 * Real-world things that break a plan after it is published. Each is phrased
 * as a hard constraint the agent must honour on the replan, so the new plan
 * is genuinely different rather than cosmetically re-labelled.
 */
export const SCENARIOS = [
  {
    id: "vehicle_down",
    label: "Vehicle breakdown",
    detail:
      "One vehicle is out of service. Plan with one FEWER route than the previous plan used, even if that costs extra distance.",
  },
  {
    id: "window_shrink",
    label: "Supplier closes early",
    detail:
      "A supplier has cut its receiving window: no pickup may be scheduled after 15:00. Every route window intersection must end at or before 15:00.",
  },
  {
    id: "capacity_drop",
    label: "Smaller vehicles only",
    detail:
      "The 1200 kg vans are unavailable. Vehicle capacity is 800 kg for this replan.",
  },
  {
    id: "zone_closed",
    label: "Road closure in Deira",
    detail:
      "Deira is closed to freight today. Any consignment dropping in Deira must be rescheduled to the depot instead, and the route must end at the depot.",
  },
];

export const scenarios = query({
  args: {},
  returns: v.array(v.any()),
  handler: async () => SCENARIOS,
});

/** Replans the latest completed plan under a disruption. */
export const trigger = mutation({
  args: { scenarioId: v.string() },
  returns: v.id("runs"),
  handler: async (ctx, { scenarioId }): Promise<Id<"runs">> => {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) throw new Error("Unknown disruption scenario.");

    const runs = await ctx.db
      .query("runs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(10);
    const base = runs.find((r) => r.status === "completed");
    if (!base) throw new Error("No completed plan to disrupt.");

    await ctx.runMutation(internal.events.log, {
      runId: base._id,
      provider: "kanroute",
      type: "disruption.raised",
      message: `Disruption: ${scenario.label}. Replanning.`,
    });

    // Vehicles on the old plan are no longer valid.
    const vehicles = await ctx.db.query("vehicles").collect();
    for (const vRow of vehicles) await ctx.db.delete("vehicles", vRow._id);

    const runId: Id<"runs"> = await ctx.runMutation(api.runs.create, {
      name: `Replan: ${scenario.label}`,
      disruption: scenario.detail,
      replanOfRunId: base._id,
    });
    return runId;
  },
});
