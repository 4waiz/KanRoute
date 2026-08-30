# KanForge - Submission

Copy-paste answers for the submission form at **https://collabute-hackathon.vercel.app**
Deadline: **17:00 GST, 30 August 2026** (strict).

---

## Project name

KanForge

## One-line description

KanForge turns technical product claims into executable evidence - it extracts the claims a company publishes, decides which ones can actually be proven, and has Devin inspect the repository and run a test to settle them.

## Problem being solved

Every software company publishes technical claims: retry counts, signing algorithms, endpoint behaviour, rate limits, uptime, compliance. Documentation drifts from implementation constantly - a retry budget gets lowered in a hotfix, the docs never get updated, and nobody notices until an integration breaks in production. Checking that documentation still matches implementation is slow, manual, and nobody's job. Tools that "check docs with AI" ask a model whether text looks plausible, which detects nothing, because a false claim reads exactly like a true one.

## Target users

Developer relations and technical writing teams who own public API documentation; platform and API teams shipping changes that silently invalidate published behaviour; technical due diligence teams assessing whether a product does what it advertises; and security or compliance reviewers who need to separate claims that are testable from claims that require attestation.

## How Devin was used

Devin is a runtime component of KanForge, not a coding assistant we used to build it. When a user verifies an executable claim, Convex opens a Devin v3 session via `POST /v3/organizations/{org_id}/sessions`, authenticated as a dedicated service user ("KanForge Verifier", Member role) whose GitHub App installation is scoped to a single repository. The session receives a strict verify-don't-implement prompt, the repository in both `repos` and the prompt text, a `structured_output_schema` that Devin validates server-side, and a `max_acu_limit` spend cap. Devin clones the repository, reads the implementation, writes a temporary test in its own isolated workspace, runs it, and returns a structured verdict with commands, files inspected, tests created, expected vs observed values, and its own limitations. On the live demo it proved the webhook-retry claim false by compiling a TypeScript test against a permanently failing transport and counting the actual attempts - documented 3 retries, observed 2. We also discovered empirically that `structured_output_required: true` does not reliably force structured output, so KanForge implements a bounded poll/nudge state machine: at most one follow-up demanding `provide_structured_output(is_final=true)`, at most forty polls, then escalation to HUMAN_REVIEW.

## How Convex was used

Convex is the backend, orchestration layer, and realtime spine - not just storage. Five tables (`analyses`, `claims`, `verificationJobs`, `evidence`, `events`) with purpose-built indexes. The architecture follows Convex's model strictly: mutations capture intent and write durable state, the scheduler hands external work to actions, actions perform network I/O and write results back through internal mutations, and the UI renders from reactive queries with no client polling. This is what makes a multi-minute agent verification feel instant - `verifyClaim` returns immediately and the proof board animates forward on its own as the scheduler drives the job. Convex also holds every API key server-side so no secret reaches the browser, and its transactional mutations make VERIFY idempotent against double-clicks. The `events` table is what powers the Technology Trace: every provider call writes a real, timestamped, provider-tagged record, so the trace is derived from recorded activity rather than reconstructed in the UI.

## How Context.dev was used

Context.dev is the entry point of the pipeline and the reason claims are source-grounded rather than paraphrased. We integrated the official `@context-dot-dev/convex` component, registered in `convex/convex.config.ts` with a typed environment contract so the API key exists only on the Convex deployment. A Convex action calls `/web/extract` with a JSON Schema describing a technical claim, so Context.dev crawls the target and returns objects already matching our shape - claim text, verbatim source excerpt, source URL, category, expected behaviour, suggested verification strategy, and confidence. KanForge performs no free-text parsing. The extraction instructions force conservative classification: compliance certifications and uptime SLAs are never allowed to be `executable`. On the live run this produced exactly the right split - the health endpoint, webhook retry, and HMAC signing claims were classified executable, while SOC 2, the 99.99% SLA, and "most loved platform" were correctly refused with stated reasons. `maxPages` bounds the crawl and `maxAgeMs` (7 days) reuses the upstream crawl on repeat runs to cut latency.

## Repository

https://github.com/4waiz/KanForge

## Demo link

https://kanforge.vercel.app

Synthetic demo target: https://kanforge.vercel.app/demo-target

## Video link

_(optional - add if recorded)_

## Pre-existing asset disclosure

All product code in this repository was written during the hackathon. Before the event began, work was limited to account creation, credential provisioning, and reading current API documentation; the repository contained no product code at the start of the event (its only commit was an empty initialisation commit).

Third-party dependencies are standard open-source packages: Next.js, React, Tailwind CSS, Convex, `@context-dot-dev/convex`, `lucide-react`, and `zod`.

**ForgeRelay**, the demo target, is a fictional company invented for this project. It does not describe, impersonate, or reference any real company or product, and is labelled as synthetic everywhere it appears. All data used is synthetic.

---

## Judging criteria - how KanForge maps

| Criterion | Weight | KanForge |
| --- | --- | --- |
| Product Value | 25% | Solves documentation drift, a real and unmeasured problem, with an output (evidence) that is directly actionable. |
| Technical Execution | 25% | Bounded agent orchestration, idempotent jobs, schema-validated verdicts, zero client-side secrets, clean build and lint. |
| Partner Integration | 25% | All three are load-bearing: remove any one and the product stops working. Made visible in-product via the pipeline strip and Technology Trace. |
| Innovation | 15% | Executes claims instead of scoring them, and refuses to fake verification it cannot perform. |
| Demonstration & Clarity | 10% | Board opens with the finding in plain English; deterministic FAIL makes the demo reproducible. |

## Three-minute presentation order

1. **Problem** - docs drift from code; nobody checks.
2. **Product** - "KanForge doesn't ask an AI whether a claim sounds credible. It runs the claim."
3. **Working functionality** - Load demo target, Analyze (live Context.dev), Verify (live Devin), FAIL with documented vs observed, open the evidence.
4. **Partner tools** - Technology Trace showing real Context.dev, Convex, and Devin events in order.
5. **Impact** - continuous claim verification and technical due diligence.
