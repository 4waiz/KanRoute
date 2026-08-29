import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { analysisStatus } from "./schema";

export const create = mutation({
  args: {
    name: v.string(),
    websiteUrl: v.string(),
    repositoryUrl: v.string(),
    isDemo: v.boolean(),
  },
  returns: v.id("analyses"),
  handler: async (ctx, args) => {
    const analysisId = await ctx.db.insert("analyses", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });

    await ctx.runMutation(internal.events.log, {
      analysisId,
      provider: "kanforge",
      type: "analysis.created",
      message: `Analysis created for ${args.websiteUrl}`,
    });

    // Client captures intent; the action does the external work.
    await ctx.scheduler.runAfter(0, internal.contextPipeline.runExtraction, {
      analysisId,
    });

    return analysisId;
  },
});

export const setStatus = internalMutation({
  args: {
    analysisId: v.id("analyses"),
    status: analysisStatus,
    error: v.optional(v.string()),
    urlsAnalyzed: v.optional(v.array(v.string())),
    pagesAnalyzed: v.optional(v.number()),
    creditsConsumed: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { analysisId, ...patch }) => {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined),
    );
    await ctx.db.patch("analyses", analysisId, clean);
    return null;
  },
});

export const get = query({
  args: { analysisId: v.id("analyses") },
  returns: v.any(),
  handler: async (ctx, { analysisId }) => ctx.db.get("analyses", analysisId),
});

export const latest = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("analyses")
      .withIndex("by_createdAt")
      .order("desc")
      .take(1);
    return rows[0] ?? null;
  },
});

export const list = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) =>
    ctx.db.query("analyses").withIndex("by_createdAt").order("desc").take(25),
});
