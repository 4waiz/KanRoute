import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { provider } from "./schema";

/** Append to the live activity trace. Every provider call writes one. */
export const log = internalMutation({
  args: {
    runId: v.optional(v.id("runs")),
    supplierId: v.optional(v.id("suppliers")),
    provider: provider,
    type: v.string(),
    message: v.string(),
    metadata: v.optional(v.string()),
  },
  returns: v.id("events"),
  handler: async (ctx, args) =>
    ctx.db.insert("events", { ...args, timestamp: Date.now() }),
});

export const byRun = query({
  args: { runId: v.id("runs"), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, { runId, limit }) =>
    ctx.db
      .query("events")
      .withIndex("by_runId_and_timestamp", (q) => q.eq("runId", runId))
      .order("desc")
      .take(limit ?? 60),
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, { limit }) =>
    ctx.db.query("events").withIndex("by_timestamp").order("desc").take(limit ?? 40),
});
