# KanRoute - Submission

Copy-paste answers for **https://collabute-hackathon.vercel.app**
Deadline: **17:00 GST, 30 August 2026** (strict).

---

## Project name

KanRoute

## One-line description

KanRoute consolidates fragmented last-mile deliveries in Dubai by reading each supplier's real goods-receiving hours off their own website, then having an autonomous engineer build, prove and dispatch a consolidated routing plan.

## Problem being solved

Dubai's roads carry thousands of half-empty delivery vans every day. Three separate vehicles drive to Jumeirah Lake Towers carrying a few hundred kilos each, at overlapping times, because every supplier books its own courier and no system knows those deliveries are compatible. The result is more vehicles, more fuel, more congestion, more emissions and a higher cost per parcel, in a city whose commercial transport strategy explicitly targets operational efficiency and lower emissions.

Consolidation is not a new idea. It does not happen because it depends on data nobody holds centrally: when can each supplier actually release goods? Those receiving hours sit on company websites in inconsistent formats and change without notice. Without them a consolidation plan is a guess, and an unusable plan is worse than no plan at all.

## Target users

Third-party logistics operators and courier networks running Dubai last-mile fleets; retail and FMCG distributors consolidating inbound supplier collections; free-zone and industrial-park operators managing vehicle movements; and sustainability teams that must evidence fleet emissions reductions rather than estimate them.

## How Context.dev was used

Context.dev supplies the constraint that makes consolidation legal. Using the official `@context-dot-dev/convex` component, registered in `convex/convex.config.ts` with a typed environment contract so the key exists only on the Convex deployment, a Convex action calls `/web/extract` against each supplier's own website with a JSON Schema for UAE address, emirate, goods-receiving hours and any stated delivery constraint.

Two consignments can only share a vehicle if their pickup windows overlap, so these hours determine the entire plan. On the live run it returned real Dubai locations: Aramex on Airport Road in Umm Ramool receiving 08:00-21:00, Al Maya Group in National Industries Park, Jebel Ali receiving 08:00-17:00, and Jumbo Electronics in Al Ghurair Centre, Deira. Al Maya's 17:00 cut-off is what caps the Business Bay route window at 08:00-17:00, so a scraped fact directly changes a routing decision.

It also reports honestly where a company publishes only general opening hours rather than dedicated receiving hours, and that caveat is surfaced in the UI. Of eleven suppliers attempted, four resolve to a mappable street address; the other seven are kept and marked unusable rather than given an invented location. The extracted address is matched to a Dubai district coordinate so distances are computed from real locations. Remove Context.dev and every time window in the system becomes an invention.

## How Convex was used

Convex is the backend, the orchestration layer and the live operational picture. Seven tables (`suppliers`, `shipments`, `runs`, `routes`, `vehicles`, `settings`, `events`) with purpose-built indexes hold the state.

The architecture follows the Convex model strictly: mutations capture intent and write durable state, the scheduler hands external work to actions, actions perform network I/O and write results back through internal mutations, and the UI renders from reactive queries with no client polling. This is what lets a multi-minute agent optimisation feel immediate: the run returns instantly and the board animates forward as the scheduler drives it. The same scheduler drives the dispatch tick that advances vehicles through their stops.

Convex holds every API key server-side so nothing sensitive reaches the browser, and the `events` table is what makes the activity feed a record of real provider calls rather than a decorative animation. The Settings view is backed by a real `settings` row that `runs.create` and `stats.summary` read, so changing vehicle capacity changes the next plan and every derived figure, with values clamped server-side.

## How Devin was used

Devin is the routing engineer, at runtime, not a coding assistant we used to build the app. When a run starts, Convex opens a Devin v3 session authenticated as a dedicated service user with the Member role, passing the consignment set, vehicle capacity, depot and the real pickup windows from Context.dev, together with a `structured_output_schema` and a `max_acu_limit` spend cap.

Devin writes a consolidation optimiser, executes it, then writes a **separate independent constraint checker** and executes that too, returning the checker's verbatim stdout. On the live run it produced a Python optimiser doing an exhaustive per-zone partition search under capacity and window-intersection constraints, and a checker verifying capacity, minimum 60-minute window overlap, single drop zone and complete non-duplicated coverage, printing `PASS` per route and `RESULT: FEASIBLE - all checks passed`. Twenty-four vans became eight routes; 1,792 km became 1,000.3 km. Every number on the dashboard is computed and verified by executed code rather than asserted by a model, and the optimiser source it wrote is viewable in the app.

One engineering detail worth noting: we established before building that `structured_output_required: true` does not reliably force structured output, since a session can answer in chat and park at `waiting_for_user`. KanRoute therefore implements a bounded poll-and-nudge state machine: at most one follow-up demanding `provide_structured_output(is_final=true)`, at most forty polls, then a clean failure. No infinite loops and no fabricated plan.

## Repository

https://github.com/4waiz/KanRoute

## Demo link

https://kanroute-uae.vercel.app

## Video link

_(optional, add if recorded)_

## Pre-existing asset disclosure

All product code in this repository was written during the hackathon. Before the event, work was limited to account creation, credential provisioning and reading current API documentation.

Supplier addresses and receiving hours are read live from each company's public website and are real. Consignment volumes, weights and destinations are synthetic test data. No affiliation with, or endorsement by, the named businesses is implied. Vehicle movement is a simulated dispatch clock advancing real Convex state; the plan, distances and savings are not simulated.

Third-party dependencies are standard open-source packages: Next.js, React, Tailwind CSS, Convex, `@context-dot-dev/convex`, `leaflet`, `react-leaflet`, `lucide-react` and `zod`. Map tiles are OpenStreetMap.

---

## Results

| | Baseline | Consolidated |
| --- | --- | --- |
| Vehicles | 36 | 13 |
| Distance | 2,690.3 km | 1,702.8 km |
| CO2 | 672.6 kg | 425.7 kg |

987.5 km removed (37%), 246.9 kg CO2 avoided, about AED 2,173 in operating cost. 100% of plans proven feasible. The larger single run cut 24 vans to 8 routes, a 44% distance reduction.

## Three-minute demo order

1. **Problem, 25s.** Three vans to JLT, half empty, overlapping windows. Dubai's commercial transport strategy targets exactly this.
2. **Suppliers, 30s.** Open Suppliers. Context.dev read these addresses and receiving hours off the companies' own sites, and honestly marks the ones that publish no address as unusable.
3. **Consolidate, 25s.** Press Run consolidation. Convex creates the run and hands it to Devin.
4. **The plan, 40s.** 24 vans become 8 routes. Toggle the map Before and After, then click one route to isolate it.
5. **The proof, 45s.** Routes view. This is the verbatim stdout of a constraint checker Devin wrote and ran; toggle to see the optimiser source it wrote. Open the Devin session link.
6. **Dispatch, 25s.** Fleet view. Dispatch the fleet, open a vehicle: its route, deliveries remaining, CO2 avoided, driver time and cost saved.
7. **Close, 20s.** Fewer vans, same deliveries, and a plan you can verify rather than trust.
