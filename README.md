# LoadShare UAE

**Fewer vans. Same deliveries.**

Dubai's roads carry thousands of half-empty delivery vehicles every day. Three separate vans drive to Jumeirah Lake Towers carrying a few hundred kilos each, at overlapping times, because no system knows their deliveries are compatible.

LoadShare finds those compatible deliveries and consolidates them, then **proves the resulting plan is actually operable** before anyone acts on it.

---

## The problem

Last-mile logistics in the UAE is fragmented by design. Each supplier books its own courier, so the road network absorbs the inefficiency: more vehicles, more fuel, more congestion, more emissions, higher cost per parcel.

Consolidation is not a new idea. The reason it does not happen is that it needs data nobody has in one place: **when can each supplier actually release goods?** Those receiving hours live on company websites, in inconsistent formats, and change. Without them a consolidation plan is a guess, and an unusable plan is worse than no plan.

## What LoadShare does

```
SUPPLIER WEBSITES
      |  address + real goods receiving hours        (Context.dev)
      v
LIVE SHIPMENT STATE
      |  consignments, vehicles, windows, capacity   (Convex)
      v
AUTONOMOUS ROUTING ENGINEER
      |  writes an optimiser, runs it,
      |  writes a constraint checker, runs that too  (Devin)
      v
PROVEN CONSOLIDATION PLAN
```

On the first live run: **12 separate vans became 5 consolidated routes**, distance fell from **898 km to 703 km**, and **49 kg of CO2** was avoided, with every consignment still delivered inside its supplier's real receiving window.

## Why each partner is essential

**Context.dev** supplies the constraint that makes consolidation legal. It reads each supplier's own website and returns a structured Dubai address plus goods-receiving hours. Two consignments can only share a vehicle if their pickup windows overlap, so these hours decide the entire plan. It also reports honestly when a company publishes only general opening hours rather than dedicated receiving hours, and that caveat is shown in the UI. Remove Context.dev and every time window becomes a guess.

**Convex** is the backend and the live operational picture. Suppliers, consignments, runs, routes and the event trace all live there. Mutations capture intent, the scheduler hands external work to actions, actions write results back through internal mutations, and the board updates reactively with no client polling. Remove Convex and there is no state, no orchestration, and no live view.

**Devin** is the routing engineer, at runtime. It receives the consignment set and constraints, writes an optimiser, executes it, then writes a **separate constraint checker** and executes that too, returning the checker's verbatim stdout. The numbers on screen are computed and verified by executed code, not asserted by a model. Remove Devin and there is no plan and no proof.

## The feasibility proof

The distinguishing feature is that LoadShare does not ask you to trust the plan. Devin returns the real output of a checker it wrote and ran:

```
PASS R1 zone=Business Bay         refs=SHP-004,SHP-005,SHP-006 load= 870/1200kg window=08:00-17:00 (540min) dist=146.29km
PASS R2 zone=DIFC                 refs=SHP-007,SHP-008         load= 370/1200kg window=08:00-17:00 (540min) dist=132.96km
PASS R3 zone=Deira                refs=SHP-009,SHP-010         load= 670/1200kg window=08:00-18:00 (600min) dist=158.29km
PASS R4 zone=Dubai Silicon Oasis  refs=SHP-011,SHP-012         load= 600/1200kg window=08:00-17:00 (540min) dist=143.64km
PASS R5 zone=Jumeirah Lake Towers refs=SHP-001,SHP-002,SHP-003 load= 730/1200kg window=08:00-18:00 (600min) dist=121.34km
PASS coverage: 12/12 assignments, missing=none, duplicated=none
TOTALS routes=5 (baseline 12 vans) distance=702.52km (baseline 898.28km, saving 195.76km)
RESULT ALL ROUTES FEASIBLE
```

Every route is checked for capacity, a window intersection of at least 60 minutes, a single drop zone, and that no consignment is dropped or duplicated.

## Bounded agent orchestration

We verified during preparation that Devin's `structured_output_required: true` does **not** reliably force structured output; a session can answer in chat and park at `waiting_for_user`. LoadShare handles this explicitly:

```
create session -> poll every 15s
  |- structured_output present    -> persist routes, mark complete
  |- stalled AND not yet nudged   -> send ONE follow-up demanding
  |                                  provide_structured_output(is_final=true)
  |- stalled AND already nudged   -> fail cleanly, surface the reason
  |- pollCount > 40 (~10 minutes) -> time out, surface the reason
```

Bounded on both axes. No infinite polling, no infinite nudging, no fabricated plan.

## How the numbers are computed

- Distance uses the haversine formula multiplied by a **1.35 urban detour factor**, applied identically to the baseline and the consolidated plan so the comparison is like for like.
- Emissions use **0.25 kg CO2e per km**, a standard diesel light commercial vehicle factor.
- The baseline is the honest status quo: one dedicated van per consignment, depot to supplier to drop and back.

## Data disclosure

Supplier **addresses and receiving hours are real**, read live from each company's public website. **Consignment volumes, weights and destinations are synthetic test data**, per event rules. No affiliation with, or endorsement by, the named businesses is implied. Area coordinates are coarse, at district level rather than rooftop.

## Local setup

```bash
npm install
npx convex dev
npm run dev
```

Server-side secrets live only on the Convex deployment:

```bash
npx convex env set CONTEXT_DEV_API_KEY
npx convex env set DEVIN_API_KEY
npx convex env set DEVIN_ORG_ID
```

Omitting the value pipes it in via stdin, keeping it out of shell history.

## Environment variables

| Name | Where it lives | Purpose |
| --- | --- | --- |
| `CONTEXT_DEV_API_KEY` | Convex deployment | Supplier enrichment, server-side only |
| `DEVIN_API_KEY` | Convex deployment | Devin v3 service-user credential |
| `DEVIN_ORG_ID` | Convex deployment | Devin organization scope |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` / Vercel | Public Convex client URL, not a secret |

## Security

- No API key reaches the browser. Context.dev and Devin are called only from Convex actions.
- `.env*` is gitignored; no secret appears in this repository.
- The Devin principal is a service user with the **Member** role, the least privilege that can create sessions.
- Devin is instructed to work only in its own workspace, never to push to a repository, and runs under a `max_acu_limit` spend cap.

## Limitations

- Coordinates are district-level, so distances are directionally right rather than routing-grade. A production build would use a road-network distance matrix.
- Consolidation currently groups by drop zone. Multi-drop routes across adjacent zones would save more and are the obvious next step.
- Receiving hours are only as good as what a company publishes; where a site lists only opening hours, LoadShare says so rather than pretending otherwise.
- The optimiser searches exhaustively per zone, which is correct at this scale but would need a heuristic beyond a few dozen consignments per zone.

## Hackathon disclosure

Built during the **Collabute X TheBlock. Hackathon**, Dubai, 30 August 2026, in accordance with event rules. All product code was written during the event. Third-party dependencies are standard open-source packages: Next.js, React, Tailwind CSS, Convex, `@context-dot-dev/convex`, `lucide-react`, and `zod`.
