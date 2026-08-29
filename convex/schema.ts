import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** Lifecycle of a whole analysis run. */
export const analysisStatus = v.union(
  v.literal("pending"),
  v.literal("discovering"),
  v.literal("extracting"),
  v.literal("ready"),
  v.literal("verifying"),
  v.literal("completed"),
  v.literal("error"),
);

/** Lifecycle of a single claim, from discovery through to a verdict. */
export const claimStatus = v.union(
  v.literal("discovering"),
  v.literal("extracted"),
  v.literal("classifying"),
  v.literal("ready"),
  v.literal("queued"),
  v.literal("devin_inspecting"),
  v.literal("devin_testing"),
  v.literal("pass"),
  v.literal("fail"),
  v.literal("human_review"),
  v.literal("error"),
);

export const claimCategory = v.union(
  v.literal("api"),
  v.literal("performance"),
  v.literal("reliability"),
  v.literal("security"),
  v.literal("integration"),
  v.literal("behavior"),
  v.literal("developer_experience"),
  v.literal("compliance"),
  v.literal("other"),
);

/** Whether a claim can be proven by executing code at all. */
export const verifiability = v.union(
  v.literal("executable"),
  v.literal("evidence_only"),
  v.literal("human_review"),
);

export const verdict = v.union(
  v.literal("PASS"),
  v.literal("FAIL"),
  v.literal("HUMAN_REVIEW"),
  v.literal("ERROR"),
);

export const jobStatus = v.union(
  v.literal("queued"),
  v.literal("creating"),
  v.literal("running"),
  v.literal("nudged"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("timeout"),
);

/** Which system produced an event — drives the Technology Trace. */
export const provider = v.union(
  v.literal("context.dev"),
  v.literal("convex"),
  v.literal("devin"),
  v.literal("kanforge"),
);

export default defineSchema({
  analyses: defineTable({
    name: v.string(),
    websiteUrl: v.string(),
    repositoryUrl: v.string(),
    status: analysisStatus,
    isDemo: v.boolean(),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    urlsAnalyzed: v.optional(v.array(v.string())),
    pagesAnalyzed: v.optional(v.number()),
    creditsConsumed: v.optional(v.number()),
  }).index("by_createdAt", ["createdAt"]),

  claims: defineTable({
    analysisId: v.id("analyses"),
    order: v.number(),
    rawClaim: v.string(),
    normalizedClaim: v.string(),
    sourceUrl: v.string(),
    sourceExcerpt: v.string(),
    category: claimCategory,
    verifiability: verifiability,
    expectedBehavior: v.string(),
    verificationStrategy: v.string(),
    confidence: v.number(),
    status: claimStatus,
    verdict: v.optional(verdict),
    humanReviewReason: v.optional(v.string()),
    suggestedEvidence: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_analysisId", ["analysisId"])
    .index("by_analysisId_and_order", ["analysisId", "order"]),

  verificationJobs: defineTable({
    analysisId: v.id("analyses"),
    claimId: v.id("claims"),
    status: jobStatus,
    devinSessionId: v.optional(v.string()),
    devinSessionUrl: v.optional(v.string()),
    devinStatus: v.optional(v.string()),
    devinStatusDetail: v.optional(v.string()),
    acusConsumed: v.optional(v.number()),
    // Guards against the PREP-discovered structured_output stall.
    nudgeSent: v.boolean(),
    pollCount: v.number(),
    startedAt: v.number(),
    lastPolledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    verdict: v.optional(verdict),
    error: v.optional(v.string()),
  })
    .index("by_claimId", ["claimId"])
    .index("by_analysisId", ["analysisId"])
    .index("by_devinSessionId", ["devinSessionId"]),

  evidence: defineTable({
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
      v.object({
        type: v.string(),
        title: v.string(),
        details: v.string(),
      }),
    ),
    raw: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_claimId", ["claimId"])
    .index("by_analysisId", ["analysisId"]),

  events: defineTable({
    analysisId: v.optional(v.id("analyses")),
    claimId: v.optional(v.id("claims")),
    jobId: v.optional(v.id("verificationJobs")),
    provider: provider,
    type: v.string(),
    message: v.string(),
    metadata: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_analysisId_and_timestamp", ["analysisId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),
});
