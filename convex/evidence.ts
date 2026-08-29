import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { verdict } from "./schema";

export const record = internalMutation({
  args: {
    analysisId: v.id("analyses"),
    claimId: v.id("claims"),
    jobId: v.optional(v.id("verificationJobs")),
    verdict: v.optional(verdict),
    summary: v.string(),
    expected: v.optional(v.string()),
    observed: v.optional(v.string()),
    commands: v.array(v.string()),
    filesInspected: v.array(v.string()),
    testFilesCreated: v.array(v.string()),
    limitations: v.array(v.string()),
    items: v.array(
      v.object({ type: v.string(), title: v.string(), details: v.string() }),
    ),
    raw: v.optional(v.string()),
  },
  returns: v.id("evidence"),
  handler: async (ctx, args) =>
    ctx.db.insert("evidence", { ...args, createdAt: Date.now() }),
});

export const byClaim = query({
  args: { claimId: v.id("claims") },
  returns: v.array(v.any()),
  handler: async (ctx, { claimId }) =>
    ctx.db
      .query("evidence")
      .withIndex("by_claimId", (q) => q.eq("claimId", claimId))
      .collect(),
});

export const byAnalysis = query({
  args: { analysisId: v.id("analyses") },
  returns: v.array(v.any()),
  handler: async (ctx, { analysisId }) =>
    ctx.db
      .query("evidence")
      .withIndex("by_analysisId", (q) => q.eq("analysisId", analysisId))
      .collect(),
});
