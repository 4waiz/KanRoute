import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { claimStatus, verdict } from "./schema";

export const insertMany = internalMutation({
  args: {
    analysisId: v.id("analyses"),
    claims: v.array(
      v.object({
        order: v.number(),
        rawClaim: v.string(),
        normalizedClaim: v.string(),
        sourceUrl: v.string(),
        sourceExcerpt: v.string(),
        category: v.string(),
        verifiability: v.string(),
        expectedBehavior: v.string(),
        verificationStrategy: v.string(),
        confidence: v.number(),
        humanReviewReason: v.optional(v.string()),
        suggestedEvidence: v.optional(v.string()),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, { analysisId, claims }) => {
    const now = Date.now();
    for (const c of claims) {
      await ctx.db.insert("claims", {
        analysisId,
        order: c.order,
        rawClaim: c.rawClaim,
        normalizedClaim: c.normalizedClaim,
        sourceUrl: c.sourceUrl,
        sourceExcerpt: c.sourceExcerpt,
        category: c.category as never,
        verifiability: c.verifiability as never,
        expectedBehavior: c.expectedBehavior,
        verificationStrategy: c.verificationStrategy,
        confidence: c.confidence,
        humanReviewReason: c.humanReviewReason,
        suggestedEvidence: c.suggestedEvidence,
        // Non-executable claims are terminal on arrival: KanForge must never
        // pretend a repo test can prove an external certification.
        status: c.verifiability === "executable" ? "ready" : "human_review",
        verdict: c.verifiability === "executable" ? undefined : "HUMAN_REVIEW",
        createdAt: now,
        updatedAt: now,
      });
    }
    return claims.length;
  },
});

export const setStatus = internalMutation({
  args: {
    claimId: v.id("claims"),
    status: claimStatus,
    verdict: v.optional(verdict),
  },
  returns: v.null(),
  handler: async (ctx, { claimId, status, verdict: vd }) => {
    await ctx.db.patch("claims", claimId, {
      status,
      ...(vd ? { verdict: vd } : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const listByAnalysis = query({
  args: { analysisId: v.id("analyses") },
  returns: v.array(v.any()),
  handler: async (ctx, { analysisId }) =>
    ctx.db
      .query("claims")
      .withIndex("by_analysisId_and_order", (q) => q.eq("analysisId", analysisId))
      .collect(),
});

export const get = query({
  args: { claimId: v.id("claims") },
  returns: v.any(),
  handler: async (ctx, { claimId }) => ctx.db.get("claims", claimId),
});

export const getInternal = internalQuery({
  args: { claimId: v.id("claims") },
  returns: v.any(),
  handler: async (ctx, { claimId }) => ctx.db.get("claims", claimId),
});
