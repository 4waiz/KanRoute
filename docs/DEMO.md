# KanForge - Demo Guide

## Three-minute demo script

**0:00 - 0:20 - The problem**

> "Every software company publishes technical claims. Retry counts, signing algorithms, endpoint behaviour, compliance. And documentation drifts from implementation constantly - someone lowers a retry budget in a hotfix, the docs never change, and nobody finds out until an integration breaks in production. Checking that docs still match code is slow, manual, and nobody's job."

**0:20 - 0:35 - What KanForge is**

> "KanForge doesn't ask an AI whether a claim sounds credible. It runs the claim."

Show the landing page. Point at the pipeline strip: Context.dev extracts → Convex orchestrates → Devin proves.

**0:35 - 1:00 - Extraction is real**

Click **Load demo target**, then **Analyze claims**.

> "That's a live Context.dev call against a public page. It crawls the target and returns claims already shaped to a JSON Schema we hand it - each one tied to its source URL and a verbatim excerpt."

Claims appear on the board as Convex persists them.

**1:00 - 1:20 - The classification is the credibility**

> "Six claims. But look - only three are marked executable. KanForge decided the SOC 2 claim, the uptime SLA, and 'most loved platform' cannot be settled by running a repository. It says so, and it says why. It will never hand you a green tick for a compliance certification."

**1:20 - 2:15 - The proof**

Select **"Failed webhook deliveries are retried exactly three times."** Click **Verify**.

> "This creates a real Devin session. Devin clones the repository, reads the implementation, writes a test, and runs it."

Show the live status moving through DEVIN TESTING. Then the verdict lands:

> **FAIL - Expected `3 retries`, Observed `2 retries`.**

Open the evidence panel.

> "This isn't a model's opinion. Devin found `MAX_RETRIES = 2` in `webhook-delivery.ts`, compiled a TypeScript test against a permanently failing transport, ran it, and counted three transport calls and two retries. Here are the commands it ran, the files it inspected, the test it created - and the Devin session ID, so you can open the session and watch it happen."

**2:15 - 2:40 - The other two outcomes**

Show a PASS claim (HMAC SHA-256 signing), then a HUMAN REVIEW claim.

> "PASS when evidence supports the claim. And human review is a feature, not a failure - it tells you exactly what evidence would settle it instead."

**2:40 - 2:55 - Technology Trace**

> "Every line here is a real recorded event. Context.dev extracted. Convex persisted. Devin verified. Convex stored the evidence. Nothing here is decorative."

**2:55 - 3:00 - Close**

> "KanForge turns technical promises into executable evidence. Claims in. Evidence out."

---

## Pre-demo checklist

- [ ] `https://kanforge.vercel.app` loads
- [ ] `https://kanforge.vercel.app/demo-target` returns 200 publicly (Context.dev must reach it)
- [ ] `https://kanforge.vercel.app/api/demo/health` returns `{"status":"ok",...}`
- [ ] Convex dashboard reachable; `CONTEXT_DEV_API_KEY`, `DEVIN_API_KEY`, `DEVIN_ORG_ID` all set
- [ ] Context.dev credits remaining (extraction costs 10 per run; hackathon code raised the balance to 3,218 and the rate limit to 60 req/min)
- [ ] Devin credit balance non-zero
- [ ] A pre-run analysis is available as a fallback if live Devin is slow

## Timing expectations

Measured on the real pipeline:

| Step | Observed |
| --- | --- |
| Context.dev extraction (6 claims, 1 page) | ~23 s |
| Devin FAIL verification (webhook retries) | ~92 s, 0 ACUs |

The 7-day `maxAgeMs` cache makes a repeated extraction against the same URL noticeably faster (~10s vs ~23s measured), because Context.dev reuses the upstream crawl. It still costs 10 credits per call, but with 3,218 credits that is roughly 320 runs - rehearse freely. This is a real API response every time, never substituted fixture data.

## If something fails live

KanForge surfaces provider errors explicitly rather than hiding them. That is the honest behaviour and it is fine to show.

- **Context.dev fails** → the board shows the failure with the provider message. Fall back to a previously completed analysis via its URL.
- **Devin is slow** → the claim stays in `DEVIN TESTING`. Switch to a pre-verified claim and return to it.
- **Devin returns no structured output** → KanForge nudges once, then escalates to HUMAN REVIEW. This is designed behaviour and worth narrating if it happens.

Never present a fallback as a live run.

## Reproducing the deterministic FAIL

The mismatch is intentional and lives in `lib/forgerelay/webhook-delivery.ts`:

```ts
export const DOCUMENTED_MAX_RETRIES = 3; // what the docs claim
export const MAX_RETRIES = 2;            // what the code does
```

`/demo-target` documents three retries. The implementation performs two. Devin finds the gap by reading the code and running a test, not by comparing strings.
