import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction, mutation } from "./_generated/server";

const DEVIN_BASE = "https://api.devin.ai/v3";

/** Bounded orchestration - never poll or nudge forever. */
const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 40; // ~10 minutes
const MAX_ACU_LIMIT = 3;

/**
 * Structured output contract. Devin validates its own output against this
 * server-side, so KanForge never parses free text for a verdict.
 */
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      enum: ["PASS", "FAIL", "HUMAN_REVIEW", "ERROR"],
    },
    summary: { type: "string" },
    expected: { type: "string" },
    observed: { type: "string" },
    commands: { type: "array", items: { type: "string" } },
    filesInspected: { type: "array", items: { type: "string" } },
    testFilesCreated: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          details: { type: "string" },
        },
        required: ["type", "title", "details"],
      },
    },
  },
  required: ["verdict", "summary", "expected", "observed"],
};

function buildPrompt(args: {
  repositoryUrl: string;
  claim: string;
  sourceExcerpt: string;
  expectedBehavior: string;
  verificationStrategy: string;
}) {
  const repoSlug = args.repositoryUrl
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

  return [
    "You are a technical verification agent working for KanForge.",
    "",
    "Your job is to VERIFY a claim, not to implement or fix the feature.",
    "",
    `Repository: ${repoSlug} (${args.repositoryUrl})`,
    "",
    `Claim: ${args.claim}`,
    "",
    `Original documentation text: ${args.sourceExcerpt}`,
    "",
    `Expected behavior: ${args.expectedBehavior}`,
    "",
    `Suggested verification: ${args.verificationStrategy}`,
    "",
    "Rules:",
    "1. Inspect the repository before drawing conclusions.",
    "2. Do not trust documentation as evidence of implementation. Read the code.",
    "3. Determine whether the claim can be objectively tested.",
    "4. Prefer an executable test over reasoning.",
    "5. You MAY create temporary test files in your own isolated workspace.",
    "6. Do NOT push changes, open pull requests, or create branches in the target repository.",
    "7. Do not modify production infrastructure.",
    "8. Do not access secrets unrelated to this verification.",
    "9. Run the relevant test or command and observe the real result.",
    "10. Record the exact expected and observed values.",
    "11. PASS only when evidence supports the claim.",
    "12. FAIL only when evidence contradicts the claim.",
    "13. Use HUMAN_REVIEW when objective automated verification is not possible.",
    "14. Never invent evidence. If you could not run something, say so in limitations.",
    "",
    "When you are done you MUST call the provide_structured_output tool with",
    "is_final=true using the required schema. Do not answer with only a chat",
    "message. Keep expected and observed short and concrete (for example",
    "'3 retries' versus '2 retries').",
  ].join("\n");
}

/** Public entry point. Idempotent against double-clicks on VERIFY. */
export const verifyClaim = mutation({
  args: { claimId: v.id("claims") },
  returns: v.any(),
  handler: async (
    ctx,
    { claimId },
  ): Promise<{
    started: boolean;
    reason?: string;
    jobId?: Id<"verificationJobs">;
  }> => {
    const claim = await ctx.db.get("claims", claimId);
    if (!claim) throw new Error("Claim not found.");

    if (claim.verifiability !== "executable") {
      return { started: false, reason: "Claim is not executable." };
    }

    const existing = await ctx.runQuery(internal.jobs.activeForClaim, {
      claimId,
    });
    if (existing) return { started: false, reason: "Already verifying." };

    const jobId: Id<"verificationJobs"> = await ctx.runMutation(
      internal.jobs.create,
      {
        analysisId: claim.analysisId,
        claimId,
      },
    );

    await ctx.runMutation(internal.claims.setStatus, {
      claimId,
      status: "queued",
    });
    await ctx.runMutation(internal.events.log, {
      analysisId: claim.analysisId,
      claimId,
      jobId,
      provider: "kanforge",
      type: "verification.queued",
      message: `Verification queued for claim #${claim.order}`,
    });

    await ctx.scheduler.runAfter(0, internal.devin.startSession, { jobId });
    return { started: true, jobId };
  },
});

export const startSession = internalAction({
  args: { jobId: v.id("verificationJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runQuery(internal.jobs.getInternal, { jobId });
    if (!job) return null;

    const claim = await ctx.runQuery(internal.claims.getInternal, {
      claimId: job.claimId,
    });
    const analysis = await ctx.runQuery(internal.contextPipeline.getAnalysis, {
      analysisId: job.analysisId,
    });
    if (!claim || !analysis) return null;

    const key = process.env.DEVIN_API_KEY;
    const org = process.env.DEVIN_ORG_ID;
    if (!key || !org) {
      await fail(ctx, jobId, claim._id, analysis._id, "Devin credentials are not configured.");
      return null;
    }

    await ctx.runMutation(internal.jobs.patchJob, { jobId, status: "creating" });
    await ctx.runMutation(internal.claims.setStatus, {
      claimId: claim._id,
      status: "devin_inspecting",
    });

    const repoSlug = analysis.repositoryUrl
      .replace(/^https?:\/\/github\.com\//, "")
      .replace(/\.git$/, "")
      .replace(/\/$/, "");

    try {
      const res = await fetch(`${DEVIN_BASE}/organizations/${org}/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: buildPrompt({
            repositoryUrl: analysis.repositoryUrl,
            claim: claim.normalizedClaim,
            sourceExcerpt: claim.sourceExcerpt,
            expectedBehavior: claim.expectedBehavior,
            verificationStrategy: claim.verificationStrategy,
          }),
          repos: [repoSlug],
          structured_output_schema: RESULT_SCHEMA,
          structured_output_required: true,
          max_acu_limit: MAX_ACU_LIMIT,
          resumable: false,
          tags: ["kanforge"],
          title: `KanForge: ${claim.normalizedClaim.slice(0, 60)}`,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        await fail(
          ctx,
          jobId,
          claim._id,
          analysis._id,
          `Devin session creation failed (${res.status}): ${text.slice(0, 180)}`,
        );
        return null;
      }

      const body = JSON.parse(text) as { session_id: string; url: string };

      await ctx.runMutation(internal.jobs.patchJob, {
        jobId,
        status: "running",
        devinSessionId: body.session_id,
        devinSessionUrl: body.url,
      });
      await ctx.runMutation(internal.claims.setStatus, {
        claimId: claim._id,
        status: "devin_testing",
      });
      await ctx.runMutation(internal.events.log, {
        analysisId: analysis._id,
        claimId: claim._id,
        jobId,
        provider: "devin",
        type: "session.created",
        message: `Devin session created: ${body.session_id}`,
        metadata: JSON.stringify({ url: body.url }),
      });

      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.devin.pollSession, {
        jobId,
      });
    } catch (err) {
      await fail(
        ctx,
        jobId,
        claim._id,
        analysis._id,
        err instanceof Error ? err.message : String(err),
      );
    }
    return null;
  },
});

export const pollSession = internalAction({
  args: { jobId: v.id("verificationJobs") },
  returns: v.null(),
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runQuery(internal.jobs.getInternal, { jobId });
    if (!job || !job.devinSessionId) return null;
    if (["completed", "failed", "timeout"].includes(job.status)) return null;

    const key = process.env.DEVIN_API_KEY!;
    const org = process.env.DEVIN_ORG_ID!;
    const pollCount = (job.pollCount ?? 0) + 1;

    if (pollCount > MAX_POLLS) {
      await ctx.runMutation(internal.jobs.patchJob, {
        jobId,
        status: "timeout",
        completedAt: Date.now(),
        verdict: "HUMAN_REVIEW",
        error: "Devin verification exceeded the time budget.",
      });
      await ctx.runMutation(internal.claims.setStatus, {
        claimId: job.claimId,
        status: "human_review",
        verdict: "HUMAN_REVIEW",
      });
      await ctx.runMutation(internal.events.log, {
        analysisId: job.analysisId,
        claimId: job.claimId,
        jobId,
        provider: "kanforge",
        type: "verification.timeout",
        message: "Verification timed out and was escalated to human review.",
      });
      return null;
    }

    const res = await fetch(
      `${DEVIN_BASE}/organizations/${org}/sessions/${job.devinSessionId}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) {
      await ctx.runMutation(internal.jobs.patchJob, {
        jobId,
        pollCount,
        lastPolledAt: Date.now(),
      });
      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.devin.pollSession, {
        jobId,
      });
      return null;
    }

    const session = (await res.json()) as {
      status?: string;
      status_detail?: string;
      acus_consumed?: number;
      structured_output?: Record<string, unknown> | null;
    };

    await ctx.runMutation(internal.jobs.patchJob, {
      jobId,
      pollCount,
      lastPolledAt: Date.now(),
      devinStatus: session.status,
      devinStatusDetail: session.status_detail,
      acusConsumed: session.acus_consumed,
    });

    const output = session.structured_output;

    if (output && Object.keys(output).length > 0) {
      await finish(ctx, jobId, job, output);
      return null;
    }

    const stalled =
      session.status_detail === "waiting_for_user" ||
      session.status === "exit" ||
      session.status === "suspended";

    // PREP finding: structured_output_required does not reliably force output.
    // One bounded nudge, then escalate rather than loop.
    if (stalled && !job.nudgeSent) {
      await ctx.runMutation(internal.jobs.patchJob, {
        jobId,
        status: "nudged",
        nudgeSent: true,
      });
      await ctx.runMutation(internal.events.log, {
        analysisId: job.analysisId,
        claimId: job.claimId,
        jobId,
        provider: "kanforge",
        type: "devin.nudged",
        message: "Devin stalled without structured output - sending one follow-up.",
      });

      await fetch(
        `${DEVIN_BASE}/organizations/${org}/sessions/${job.devinSessionId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message:
              "Call the provide_structured_output tool now using the requested schema with is_final=true. Do not provide only a chat response. Finish after submitting structured output.",
          }),
        },
      );

      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.devin.pollSession, {
        jobId,
      });
      return null;
    }

    if (stalled && job.nudgeSent) {
      await ctx.runMutation(internal.jobs.patchJob, {
        jobId,
        status: "failed",
        completedAt: Date.now(),
        verdict: "HUMAN_REVIEW",
        error: "Devin ended without returning structured output.",
      });
      await ctx.runMutation(internal.claims.setStatus, {
        claimId: job.claimId,
        status: "human_review",
        verdict: "HUMAN_REVIEW",
      });
      await ctx.runMutation(internal.events.log, {
        analysisId: job.analysisId,
        claimId: job.claimId,
        jobId,
        provider: "kanforge",
        type: "verification.escalated",
        message: "No structured output after one nudge - escalated to human review.",
      });
      return null;
    }

    await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.devin.pollSession, {
      jobId,
    });
    return null;
  },
});

async function finish(
  ctx: ActionCtx,
  jobId: Id<"verificationJobs">,
  job: { analysisId: Id<"analyses">; claimId: Id<"claims"> },
  output: Record<string, unknown>,
) {
  const asArray = (val: unknown): string[] =>
    Array.isArray(val) ? val.map((x) => String(x)) : [];

  const rawVerdict = String(output.verdict ?? "ERROR").toUpperCase();
  const verdict = (
    ["PASS", "FAIL", "HUMAN_REVIEW", "ERROR"].includes(rawVerdict)
      ? rawVerdict
      : "ERROR"
  ) as "PASS" | "FAIL" | "HUMAN_REVIEW" | "ERROR";

  const items = Array.isArray(output.evidence)
    ? (output.evidence as Record<string, unknown>[]).map((e) => ({
        type: String(e.type ?? "other"),
        title: String(e.title ?? ""),
        details: String(e.details ?? ""),
      }))
    : [];

  await ctx.runMutation(internal.evidence.record, {
    analysisId: job.analysisId,
    claimId: job.claimId,
    jobId,
    verdict,
    summary: String(output.summary ?? ""),
    expected: output.expected ? String(output.expected) : undefined,
    observed: output.observed ? String(output.observed) : undefined,
    commands: asArray(output.commands),
    filesInspected: asArray(output.filesInspected),
    testFilesCreated: asArray(output.testFilesCreated),
    limitations: asArray(output.limitations),
    items,
    raw: JSON.stringify(output, null, 2).slice(0, 60_000),
  });

  await ctx.runMutation(internal.jobs.patchJob, {
    jobId,
    status: "completed",
    completedAt: Date.now(),
    verdict,
  });

  const claimStatus = (
    verdict === "PASS"
      ? "pass"
      : verdict === "FAIL"
        ? "fail"
        : verdict === "HUMAN_REVIEW"
          ? "human_review"
          : "error"
  ) as "pass" | "fail" | "human_review" | "error";

  await ctx.runMutation(internal.claims.setStatus, {
    claimId: job.claimId,
    status: claimStatus,
    verdict,
  });

  await ctx.runMutation(internal.events.log, {
    analysisId: job.analysisId,
    claimId: job.claimId,
    jobId,
    provider: "devin",
    type: "verification.completed",
    message: `Devin returned ${verdict}`,
  });
  await ctx.runMutation(internal.events.log, {
    analysisId: job.analysisId,
    claimId: job.claimId,
    jobId,
    provider: "convex",
    type: "evidence.persisted",
    message: "Evidence persisted to Convex",
  });
}

async function fail(
  ctx: ActionCtx,
  jobId: Id<"verificationJobs">,
  claimId: Id<"claims">,
  analysisId: Id<"analyses">,
  message: string,
) {
  await ctx.runMutation(internal.jobs.patchJob, {
    jobId,
    status: "failed",
    completedAt: Date.now(),
    verdict: "ERROR",
    error: message,
  });
  await ctx.runMutation(internal.claims.setStatus, {
    claimId,
    status: "error",
    verdict: "ERROR",
  });
  await ctx.runMutation(internal.events.log, {
    analysisId,
    claimId,
    jobId,
    provider: "devin",
    type: "session.failed",
    message: message.slice(0, 240),
  });
}

/** Read-only probe used by the integration health indicators. */
export const health = action({
  args: {},
  returns: v.any(),
  handler: async () => {
    const key = process.env.DEVIN_API_KEY;
    const org = process.env.DEVIN_ORG_ID;
    if (!key || !org) return { ok: false, reason: "not configured" };
    const res = await fetch(`${DEVIN_BASE}/self`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    return { ok: res.ok, status: res.status };
  },
});
