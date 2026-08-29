# KanForge — Submission

Ready-to-paste answers for the submission form.

---

## Project name

KanForge

## Tagline

Claims in. Evidence out.

## Short product description

KanForge turns technical product claims into executable evidence. It extracts the claims a company makes in its own documentation, decides which ones can actually be proven, then has an autonomous agent inspect the repository, write a test, and run it. The result is a verdict backed by commands, files, and observed output — not a model's opinion.

## Problem

Every software company publishes technical claims: retry counts, signing algorithms, endpoint behaviour, rate limits, uptime, compliance. Documentation drifts from implementation constantly — a retry budget gets lowered in a hotfix, the docs never get updated, and nobody notices until an integration breaks in production.

Checking that documentation still matches implementation is slow, manual, and nobody's job. Tools that "check docs with AI" ask a model whether text looks plausible, which detects nothing: a false claim reads exactly like a true one.

## Target users

- Developer relations and technical writing teams who own public API documentation
- Platform and API teams shipping changes that silently invalidate published behaviour
- Technical due diligence — investors and acquirers assessing whether a product does what it advertises
- Security and compliance reviewers separating claims that are testable from claims that need attestation

## How Context.dev was used

Context.dev is the entry point of the pipeline and the reason claims are *source-grounded* rather than paraphrased.

We integrated the official `@context-dot-dev/convex` component, registered in `convex/convex.config.ts` with a typed environment contract so the API key exists only on the Convex deployment. A Convex action calls `/web/extract` with a JSON Schema describing a technical claim, so Context.dev crawls the target and returns objects already matching our shape — claim text, verbatim source excerpt, source URL, category, expected behaviour, suggested verification strategy, and confidence. KanForge performs no free-text parsing.

The extraction instructions deliberately force conservative classification: compliance certifications and uptime SLAs are never allowed to be `executable`. On the live demo run this produced exactly the right split — the health endpoint, webhook retry, and HMAC signing claims were classified executable, while SOC 2, the 99.99% SLA, and "most loved platform" were correctly refused with stated reasons.

Cost controls: `maxPages: 3` bounds the crawl and `maxAgeMs` (7 days) caches repeated demo runs.

## How Convex was used

Convex is the backend, orchestration layer, and realtime spine — not just storage.

Five tables (`analyses`, `claims`, `verificationJobs`, `evidence`, `events`) with purpose-built indexes. The architecture follows Convex's model strictly: mutations capture intent and write durable state, the scheduler hands external work to actions, actions perform network I/O and write results back through internal mutations, and the UI renders from reactive queries with no client polling.

This is what makes a multi-minute agent verification feel instant — `verifyClaim` returns immediately, and the proof board animates forward on its own as the scheduler drives the job. Convex also holds every API key server-side, so no secret ever reaches the browser, and its transactional mutations make VERIFY idempotent against double-clicks.

The `events` table is what powers the Technology Trace: every provider call writes a real, timestamped, provider-tagged record.

## How Devin was used

Devin is a **runtime component of the product**, not a coding assistant we used to build it.

When a user verifies an executable claim, Convex creates a `verificationJob` and opens a Devin v3 session via `POST /v3/organizations/{org_id}/sessions`, authenticated as a dedicated **service user** ("KanForge Verifier", Member role) whose GitHub App installation is scoped to a single repository. The session receives a strict verify-don't-implement prompt, the repository in both `repos` and the prompt text, a `structured_output_schema` that Devin validates server-side, and a `max_acu_limit` spend cap.

Devin clones the repository, reads the implementation, writes a temporary test in its own isolated workspace, runs it, and returns a structured verdict with commands, files inspected, tests created, expected vs observed values, and its own limitations.

On the live demo it found that `webhook-delivery.ts` caps retries at 2 while the documentation claims 3 — by compiling a TypeScript test against a permanently failing transport and counting the actual attempts. For the signing claim it grepped the repository, compiled the module, and performed a real HTTP POST to confirm the signature verified.

**One thing worth highlighting:** we discovered before writing the integration that `structured_output_required: true` does not reliably force structured output — sessions can answer in chat and park at `waiting_for_user`. KanForge implements a bounded poll/nudge state machine to handle this: at most one follow-up demanding `provide_structured_output(is_final=true)`, at most forty polls, then escalation to HUMAN_REVIEW. No infinite loops, no fabricated verdicts.

## Technical implementation

Next.js 16 (App Router) + TypeScript + Tailwind on Vercel; Convex for backend, orchestration, and realtime; Context.dev via its official Convex component; Devin v3 via its Organization API.

Notable engineering decisions:

- **Classification is a hard boundary.** Non-executable claims are marked terminal at insert time. There is no code path that can produce a PASS for a claim a repository test cannot settle.
- **Bounded agent orchestration.** Poll and nudge counts are persisted per job and capped on both axes.
- **Idempotent verification.** An active job for a claim blocks a second session.
- **Honest failure.** Provider errors surface with their real messages; there is no fixture substitution in live mode.
- **Secrets never client-side.** Both third-party APIs are reachable only from Convex actions.

## Potential impact

Documentation drift is a universal, unmeasured problem. Every API provider has claims in production docs that no longer match the code, and today the only detection mechanism is a customer hitting the gap.

KanForge makes that gap measurable and continuously checkable. The same pipeline supports technical due diligence — pointing it at a target company's docs and repository produces an evidence-backed picture of which claims hold up — and the classification boundary is what makes it credible: a tool that admits what it cannot prove is one whose PASS verdicts are worth reading.

The natural extension is claim drift monitoring: Context.dev already supports website monitors, so a changed claim can automatically trigger re-verification.

## Repository

https://github.com/4waiz/KanForge

## Demo link

https://kanforge.vercel.app

Synthetic demo target: https://kanforge.vercel.app/demo-target

## Pre-existing asset disclosure

All product code in the repository was written during TheBlock. Hackathon. Before the event began, work was limited to account creation, credential provisioning, and reading current API documentation; the repository contained no product code at the start of the event (its only commit was an empty initialization commit).

Third-party dependencies are standard open-source packages: Next.js, React, Tailwind CSS, Convex, `@context-dot-dev/convex`, `lucide-react`, and `zod`.

**ForgeRelay**, the demo target, is a fictional company invented for this project. It does not describe, impersonate, or reference any real company or product, and is labelled as synthetic everywhere it appears.
