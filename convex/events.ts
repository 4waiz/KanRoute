import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { provider } from "./schema";

/** Append an event to the Technology Trace. Every provider action logs here. */
export const log = internalMutation({
  args: {
    analysisId: v.optional(v.id("analyses")),
    claimId: v.optional(v.id("claims")),
    jobId: v.optional(v.id("verificationJobs")),
    provider: provider,
    type: v.string(),
    message: v.string(),
    metadata: v.optional(v.string()),
  },
  returns: v.id("events"),
  handler: async (ctx, args) =>
    ctx.db.insert("events", { ...args, timestamp: Date.now() }),
});

export const listByAnalysis = query({
  args: { analysisId: v.id("analyses"), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, { analysisId, limit }) => {
    const rows = await ctx.db
      .query("events")
      .withIndex("by_analysisId_and_timestamp", (q) =>
        q.eq("analysisId", analysisId),
      )
      .order("desc")
      .take(limit ?? 60);
    return rows;
  },
});
