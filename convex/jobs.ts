import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { jobStatus, verdict } from "./schema";

export const create = internalMutation({
  args: { analysisId: v.id("analyses"), claimId: v.id("claims") },
  returns: v.id("verificationJobs"),
  handler: async (ctx, { analysisId, claimId }) =>
    ctx.db.insert("verificationJobs", {
      analysisId,
      claimId,
      status: "queued",
      nudgeSent: false,
      pollCount: 0,
      startedAt: Date.now(),
    }),
});

export const patchJob = internalMutation({
  args: {
    jobId: v.id("verificationJobs"),
    status: v.optional(jobStatus),
    devinSessionId: v.optional(v.string()),
    devinSessionUrl: v.optional(v.string()),
    devinStatus: v.optional(v.string()),
    devinStatusDetail: v.optional(v.string()),
    acusConsumed: v.optional(v.number()),
    nudgeSent: v.optional(v.boolean()),
    pollCount: v.optional(v.number()),
    lastPolledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    verdict: v.optional(verdict),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { jobId, ...patch }) => {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch("verificationJobs", jobId, clean);
    return null;
  },
});

export const getInternal = internalQuery({
  args: { jobId: v.id("verificationJobs") },
  returns: v.any(),
  handler: async (ctx, { jobId }) => ctx.db.get("verificationJobs", jobId),
});

/** Used to make VERIFY idempotent against double-clicks. */
export const activeForClaim = internalQuery({
  args: { claimId: v.id("claims") },
  returns: v.any(),
  handler: async (ctx, { claimId }) => {
    const rows = await ctx.db
      .query("verificationJobs")
      .withIndex("by_claimId", (q) => q.eq("claimId", claimId))
      .collect();
    return (
      rows.find((r) =>
        ["queued", "creating", "running", "nudged"].includes(r.status),
      ) ?? null
    );
  },
});

export const byClaim = query({
  args: { claimId: v.id("claims") },
  returns: v.any(),
  handler: async (ctx, { claimId }) => {
    const rows = await ctx.db
      .query("verificationJobs")
      .withIndex("by_claimId", (q) => q.eq("claimId", claimId))
      .collect();
    return rows.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
  },
});

export const byAnalysis = query({
  args: { analysisId: v.id("analyses") },
  returns: v.array(v.any()),
  handler: async (ctx, { analysisId }) =>
    ctx.db
      .query("verificationJobs")
      .withIndex("by_analysisId", (q) => q.eq("analysisId", analysisId))
      .collect(),
});
