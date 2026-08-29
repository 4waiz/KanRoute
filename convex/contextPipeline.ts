import { ContextDev } from "@context-dot-dev/convex";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";

const contextDev = new ContextDev(components.contextDev);

const CATEGORIES = [
  "api",
  "performance",
  "reliability",
  "security",
  "integration",
  "behavior",
  "developer_experience",
  "compliance",
  "other",
];

const VERIFIABILITY = ["executable", "evidence_only", "human_review"];

/**
 * JSON Schema handed to Context.dev /web/extract. The endpoint crawls the
 * target and returns data already shaped like this, so KanForge never has to
 * post-process free text.
 */
const CLAIM_SCHEMA = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: {
            type: "string",
            description: "The technical claim, restated as one precise sentence.",
          },
          sourceExcerpt: {
            type: "string",
            description: "Verbatim sentence from the page that makes the claim.",
          },
          sourceUrl: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          verifiability: { type: "string", enum: VERIFIABILITY },
          expectedBehavior: {
            type: "string",
            description:
              "The concrete observable behaviour that must hold for the claim to be true.",
          },
          suggestedVerification: {
            type: "string",
            description:
              "How an engineer with the source repository would objectively test this.",
          },
          whyNotExecutable: {
            type: "string",
            description:
              "If verifiability is not executable, why code execution cannot settle it.",
          },
          suggestedEvidence: {
            type: "string",
            description:
              "If not executable, what external evidence would settle it.",
          },
          confidence: { type: "number" },
        },
        required: [
          "claim",
          "sourceExcerpt",
          "category",
          "verifiability",
          "expectedBehavior",
          "suggestedVerification",
          "confidence",
        ],
      },
    },
  },
  required: ["claims"],
};

const INSTRUCTIONS = [
  "Extract the technical and product claims this site makes about its own software.",
  "",
  "Classify each claim verifiability strictly and conservatively:",
  "- executable: an engineer with the source repository could write and run a test that objectively settles it. Examples: specific endpoint behaviour, retry counts, signing algorithms, response shapes.",
  "- evidence_only: objectively checkable in principle, but not by running the repository. Examples: uptime SLAs, published benchmarks.",
  "- human_review: subjective, promotional, or dependent on external attestation. Examples: most loved, developers trust us, SOC 2 Type II compliant.",
  "",
  "Do NOT mark a claim executable just because it sounds technical. Compliance certifications and uptime SLAs are never executable.",
  "",
  "Prefer 4-8 of the strongest, most specific claims. Ignore navigation, cookie notices and boilerplate.",
].join("\n");

export const getAnalysis = internalQuery({
  args: { analysisId: v.id("analyses") },
  returns: v.any(),
  handler: async (ctx, { analysisId }) => ctx.db.get("analyses", analysisId),
});

export const runExtraction = internalAction({
  args: { analysisId: v.id("analyses") },
  returns: v.null(),
  handler: async (ctx, { analysisId }) => {
    const analysis = await ctx.runQuery(internal.contextPipeline.getAnalysis, {
      analysisId,
    });
    if (!analysis) return null;

    await ctx.runMutation(internal.analyses.setStatus, {
      analysisId,
      status: "discovering",
      startedAt: Date.now(),
    });
    await ctx.runMutation(internal.events.log, {
      analysisId,
      provider: "context.dev",
      type: "crawl.started",
      message: `Context.dev crawl started for ${analysis.websiteUrl}`,
    });

    try {
      const result = (await contextDev.extract(ctx, {
        body: {
          url: analysis.websiteUrl,
          schema: CLAIM_SCHEMA,
          instructions: INSTRUCTIONS,
          maxPages: 3,
          // 7-day upstream cache: repeated rehearsals reuse the same crawl, which
          // roughly halves latency. Still billed at 10 credits per call.
          maxAgeMs: 604800000,
        },
      })) as {
        data?: { claims?: unknown[] };
        urls_analyzed?: string[];
        metadata?: { numUrls?: number };
      };

      const urls = result.urls_analyzed ?? [];
      await ctx.runMutation(internal.events.log, {
        analysisId,
        provider: "context.dev",
        type: "crawl.completed",
        message: `Context.dev analyzed ${urls.length || result.metadata?.numUrls || 0} page(s)`,
        metadata: JSON.stringify({ urls }),
      });

      await ctx.runMutation(internal.analyses.setStatus, {
        analysisId,
        status: "extracting",
        urlsAnalyzed: urls,
        pagesAnalyzed: urls.length,
      });

      const raw = (result.data?.claims ?? []) as Record<string, unknown>[];
      const claims = raw.map((c, i) => {
        const verifiability = VERIFIABILITY.includes(String(c.verifiability))
          ? String(c.verifiability)
          : "human_review";
        const category = CATEGORIES.includes(String(c.category))
          ? String(c.category)
          : "other";
        const text = String(c.claim ?? "").trim();
        return {
          order: i + 1,
          rawClaim: String(c.sourceExcerpt ?? text).trim(),
          normalizedClaim: text,
          sourceUrl: String(c.sourceUrl ?? analysis.websiteUrl),
          sourceExcerpt: String(c.sourceExcerpt ?? "").trim(),
          category,
          verifiability,
          expectedBehavior: String(c.expectedBehavior ?? "").trim(),
          verificationStrategy: String(c.suggestedVerification ?? "").trim(),
          confidence:
            typeof c.confidence === "number"
              ? Math.max(0, Math.min(1, c.confidence))
              : 0.5,
          humanReviewReason: c.whyNotExecutable
            ? String(c.whyNotExecutable)
            : undefined,
          suggestedEvidence: c.suggestedEvidence
            ? String(c.suggestedEvidence)
            : undefined,
        };
      });

      if (claims.length === 0) {
        await ctx.runMutation(internal.analyses.setStatus, {
          analysisId,
          status: "error",
          error: "Context.dev returned no technical claims for this URL.",
          completedAt: Date.now(),
        });
        return null;
      }

      await ctx.runMutation(internal.claims.insertMany, { analysisId, claims });

      for (const c of claims) {
        await ctx.runMutation(internal.events.log, {
          analysisId,
          provider: "context.dev",
          type: "claim.extracted",
          message: `Extracted [${c.verifiability}] ${c.normalizedClaim.slice(0, 90)}`,
        });
      }
      await ctx.runMutation(internal.events.log, {
        analysisId,
        provider: "convex",
        type: "claims.persisted",
        message: `Persisted ${claims.length} claims to Convex`,
      });

      await ctx.runMutation(internal.analyses.setStatus, {
        analysisId,
        status: "ready",
        completedAt: Date.now(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.events.log, {
        analysisId,
        provider: "context.dev",
        type: "crawl.failed",
        message: `Context.dev extraction failed: ${message.slice(0, 200)}`,
      });
      await ctx.runMutation(internal.analyses.setStatus, {
        analysisId,
        status: "error",
        error: message.slice(0, 400),
        completedAt: Date.now(),
      });
    }
    return null;
  },
});
