import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";

/** Re-run enrichment for every supplier (Context.dev cache makes this cheap). */
export const all = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const rows = await ctx.db.query("suppliers").collect();
    for (const r of rows) {
      await ctx.scheduler.runAfter(0, internal.suppliers.enrich, {
        supplierId: r._id,
      });
    }
    return rows.length;
  },
});
