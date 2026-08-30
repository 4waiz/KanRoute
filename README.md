# KanRoute

**Fewer vans. Same deliveries.**

Dubai's roads carry thousands of half-empty delivery vehicles every day. Three separate vans drive to Jumeirah Lake Towers carrying a few hundred kilos each, at overlapping times, because no system knows their deliveries are compatible.

KanRoute finds those compatible deliveries, consolidates them, and **proves the resulting plan is operable** before anyone acts on it.

**Live:** https://kanroute-ae.vercel.app · **Repo:** https://github.com/4waiz/KanRoute

---

## The problem

Last-mile logistics in the UAE is fragmented by design. Each supplier books its own courier, so the road network absorbs the inefficiency: more vehicles, more fuel, more congestion, more emissions, higher cost per parcel.

Consolidation is not a new idea. It does not happen because it needs data nobody holds in one place: **when can each supplier actually release goods?** Those receiving hours live on company websites, in inconsistent formats, and change. Without them a consolidation plan is a guess, and an unusable plan is worse than no plan.

## What it does

```
SUPPLIER WEBSITES
      |  address + real goods receiving hours        (Context.dev)
      v
LIVE OPERATIONAL STATE
      |  consignments, routes, vehicles, events      (Convex)
      v
AUTONOMOUS ROUTING ENGINEER
      |  writes an optimiser, runs it,
      |  writes a constraint checker, runs that too  (Devin)
      v
PROVEN PLAN, THEN A DISPATCHED FLEET
```

## Results to date

Two completed runs, both proven feasible:

| | Baseline | Consolidated |
| --- | --- | --- |
| Vehicles | 36 | **13** |
| Distance | 2,690.3 km | **1,702.8 km** |
| CO2 | 672.6 kg | **425.7 kg** |

**987.5 km removed (37%), 246.9 kg CO2 avoided, roughly AED 2,173 in operating cost.** Average vehicle utilisation 60%, 2.8 stops per route, 100% of plans proven feasible.

The larger run alone: **24 consignments on 24 vans became 8 routes**, 1,792 km down to 1,000.3 km — a 44% cut — with all 24 consignments covered exactly once and every pickup window respected.

## Why each partner is essential

**Context.dev** supplies the constraint that makes consolidation legal. Using the official `@context-dot-dev/convex` component, a Convex action calls `/web/extract` against each supplier's own website with a JSON Schema for UAE address, emirate, goods-receiving hours and any stated delivery constraint. Two consignments can only share a vehicle if their pickup windows overlap, so these hours decide the entire plan. Remove Context.dev and every time window becomes an invention.

**Convex** is the backend, the orchestration layer, and the live operational picture. Mutations capture intent, the scheduler hands external work to actions, actions do network I/O and write back through internal mutations, and the UI renders from reactive queries with no client polling. It also holds every API key server-side. Remove Convex and there is no state, no orchestration, and no live view.

**Devin** is the routing engineer, at runtime — not a coding assistant used to build the app. It receives the consignment set and constraints, writes an optimiser, executes it, then writes a **separate constraint checker** and executes that too, returning the checker's verbatim stdout. Remove Devin and there is no plan and no proof.

## The feasibility proof

KanRoute does not ask you to trust the plan. Devin returns the real output of a checker it wrote and ran:

```
KanRoute - route feasibility check
capacity=1200kg  min_window=60min  routes=8
PASS RTE-01 Business Bay          load= 870/1200kg window=08:00-17:00 (540min) dist= 112.83km
PASS RTE-02 DIFC                  load= 645/1200kg window=08:00-17:00 (540min) dist= 124.63km
PASS RTE-03 Deira                 load= 880/1200kg window=08:00-18:00 (600min) dist= 117.70km
PASS RTE-04 Downtown Dubai        load= 735/1200kg window=08:00-17:00 (540min) dist= 124.62km
PASS RTE-05 Dubai Marina          load= 720/1200kg window=08:00-17:00 (540min) dist= 124.13km
PASS RTE-06 Dubai Silicon Oasis   load= 795/1200kg window=08:00-17:00 (540min) dist= 127.63km
PASS RTE-07 Jumeirah Lake Towers  load= 730/1200kg window=08:00-18:00 (600min) dist= 121.34km
PASS RTE-08 Mirdif                load= 780/1200kg window=08:00-17:00 (540min) dist= 147.42km
PASS coverage: 24/24 consignments assigned exactly once
totals: routes=8 (baseline vans=24)  distance=1000.3km (baseline 1792.0km)
RESULT: FEASIBLE - all checks passed
```

Every route is asserted for capacity, a window intersection of at least 60 minutes, a single drop zone, and complete non-duplicated coverage.

## Bounded agent orchestration

We verified before building that Devin's `structured_output_required: true` does **not** reliably force structured output; a session can answer in chat and park at `waiting_for_user`. KanRoute handles that explicitly:

```
create session -> poll every 15s
  |- structured_output present    -> persist routes, mark complete
  |- stalled AND not yet nudged   -> send ONE follow-up demanding
  |                                  provide_structured_output(is_final=true)
  |- stalled AND already nudged   -> fail cleanly, surface the reason
  |- pollCount > 40 (~10 minutes) -> time out, surface the reason
```

Bounded on both axes. No infinite polling, no infinite nudging, no fabricated plan.

## The application

Six views sharing a fixed console shell. The page itself never scrolls on desktop; panels scroll internally.

| View | What it does |
| --- | --- |
| **Overview** | Four headline numbers, live map, route list, fleet status |
| **Map** | Full route layers with per-route visibility, isolation, and Before/After |
| **Routes** | Route table with fill, windows and consignments, plus the proof and the optimiser source Devin wrote |
| **Fleet** | Vehicles running the plan, and per-vehicle detail |
| **Suppliers** | Enrichment provenance, and adding a supplier by URL |
| **Settings** | Operating parameters that genuinely drive the engine |

**Fleet status** turns a proven plan into vehicles. Each has a plate, driver, zone, stop progress, and a detail view showing its route, deliveries completed and remaining, CO2 avoided, driver time saved, and cost avoided.

**Settings is wired, not decorative.** Vehicle capacity, operating cost, emissions factor, detour factor, average speed and crawl depth live in Convex; `runs.create` and `stats.summary` read them, so changing capacity changes the next plan and every derived figure. Values are clamped so a typo cannot produce nonsense savings.

## Map rendering

Every route leaves the same depot, so drawn naively they collapse into an unreadable starburst. Four things keep the plan legible.

**Geometry.** Route geometry is computed in a local equirectangular frame measured in kilometres, so a sideways offset is a real distance on the ground rather than a number of degrees that would stretch differently along latitude and longitude. Legs run straight between stops with quadratic fillets at the corners. A spline was tried first and rejected: with a 2 km hop out of the depot followed by a 20 km run, Catmull-Rom gives the first control point an enormous tangent and the route balloons into a loop no vehicle would ever drive. A fillet is bounded by its own corner, so the line always stays on the legs it is meant to follow.

**Lanes.** Routes sharing a corridor are given a deterministic lane from their index, centred on zero, and offset perpendicular by that lane. The offset tapers to zero at both ends, so routes still meet the depot and their drop point exactly and separate only along the corridor between. Lane width is a fraction of the plan's own extent, not a fixed distance, so separation looks the same whether a plan covers one district or the whole emirate. Leaving the depot, each route is routed through a gate point rotated a few degrees per lane, so departures fan out instead of stacking on the same pixels.

**Layering.** Explicit leaflet panes: basemap 200, place names 350, route casing 405, route body 410, focused route 440, markers 600. Every route carries a dark casing under its colour, which is what stops crossings reading as one tangled mesh, and the focused route sits in its own pane so it is above every other line regardless of route order. Markers are always above every line.

**Hierarchy.** With nothing selected, routes sit at 2.6 px and stops are plain dots. Hovering or selecting a route promotes it to 4.2 px at full opacity with a marching dash showing direction of travel and numbered stop pins, while every other route drops to 1.9 px at 28%. Return legs and zone labels are drawn only for the focused route, since shown all at once they overlap into noise.

The basemap is Esri's dark canvas, a purpose-built dark basemap served without an API key, with place names on their own layer beneath the routes. It replaced an inverted OpenStreetMap layer, which flattened Dubai into a near-black slab and left the routes looking pasted onto a dark rectangle. Leaflet snaps `fitBounds` down to a whole zoom level by default, which left the plan filling barely half the panel, so the map runs with fractional zoom.

Coordinates are district-level, so distances are directionally right rather than routing-grade. Routes are not snapped to roads: doing so would mean ~32 calls per plan to a public routing demo server with no SLA, and a rate limit mid-demo is a worse failure than a slightly abstract line.

## How the numbers are computed

- **Baseline** is the honest status quo: one dedicated van per consignment, depot to supplier to drop and back.
- **Distance** is haversine multiplied by a 1.35 urban detour factor, applied identically to baseline and consolidated so the comparison is like for like.
- **Emissions** use 0.25 kg CO2e per km, a standard diesel light commercial vehicle factor.
- **Cost** uses an indicative AED 2.20/km all-in operating cost. It is an estimate, and the rate is shown next to the figure.

All four are editable in Settings, and all four are stated in the UI rather than buried.

## Data disclosure

Supplier **addresses and receiving hours are real**, read live from each company's public website. **Consignment volumes, weights and destinations are synthetic test data.** No affiliation with, or endorsement by, the named businesses is implied.

Of 11 suppliers attempted, **4 are usable**. The rest publish no resolvable street address, so KanRoute marks them unusable rather than inventing a location. That gap is the data problem the product exists to solve, so it is shown rather than hidden.

The **dispatch clock is simulated**: vehicle progress is real Convex state advanced by a scheduled tick. The plan, the distances and the savings are not simulated.

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
- The Devin principal is a service user with the **Member** role, the least privilege that can create sessions, and its GitHub App installation is scoped to a single repository.
- Devin is instructed to work only in its own workspace, never to push, and runs under a `max_acu_limit` spend cap.

## Limitations

- District-level coordinates, so distances are directionally right rather than routing-grade. Production would use a road-network distance matrix.
- Consolidation groups by drop zone. Multi-drop routes across adjacent zones would save more and are the obvious next step.
- Receiving hours are only as good as what a company publishes; where a site lists only opening hours, KanRoute says so.
- The optimiser searches exhaustively per zone, correct at this scale but needing a heuristic beyond a few dozen consignments per zone.
- Vehicle movement is a simulated clock, not telemetry.

## Design

The interface is dark, built on a palette sampled from the logo itself: `#3048cc` at the base of the mark and `#60f0a8` at the arrow tips. Blue carries brand and action, mint carries success and savings, so green never means two things at once, and teal from the midpoint of the gradient marks vehicles in transit.

## Hackathon disclosure

Built during the **Collabute X TheBlock. Hackathon**, Dubai, 30 August 2026, in accordance with event rules. All product code was written during the event. Third-party dependencies are standard open-source packages: Next.js, React, Tailwind CSS, Convex, `@context-dot-dev/convex`, `leaflet`, `react-leaflet`, `lucide-react` and `zod`.
