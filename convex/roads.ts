import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { DEPOT } from "./geo";

/**
 * Road geometry for a plan.
 *
 * Straight chords between district coordinates cut across the sea, through
 * blocks and over open desert, which makes a real plan look invented. OSRM
 * returns the actual driveable geometry, so a leg follows the roads a van
 * would take.
 *
 * It is fetched once, server-side, when a plan is saved, and stored on the
 * route. Nothing is requested while anyone is looking at the map: a routing
 * service being slow or rate-limited can never affect a live demo, and a
 * route that fails to resolve simply keeps its straight-line fallback.
 */
const OSRM = "https://router.project-osrm.org/route/v1/driving";

/** Politeness gap between calls to a free public service. */
const GAP_MS = 220;

/** Keep the stored path detailed enough to read as a road, small enough to
 *  ship to the browser. OSRM returns roughly a point every 70 m. */
const MIN_POINT_SPACING_KM = 0.04;
const MAX_POINTS = 420;

type LatLng = { lat: number; lng: number };
type Path = number[][];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Drop points closer together than the spacing threshold, always keeping
 *  the last one so the path still ends exactly where the route does. */
function thin(points: Path): Path {
  if (points.length <= 2) return points;
  const out: Path = [points[0]];
  let last = { lat: points[0][0], lng: points[0][1] };
  for (let i = 1; i < points.length - 1; i++) {
    const p = { lat: points[i][0], lng: points[i][1] };
    if (haversineKm(last, p) < MIN_POINT_SPACING_KM) continue;
    out.push(points[i]);
    last = p;
  }
  out.push(points[points.length - 1]);
  if (out.length <= MAX_POINTS) return out;
  const step = Math.ceil(out.length / MAX_POINTS);
  const capped = out.filter((_, i) => i % step === 0);
  capped.push(out[out.length - 1]);
  return capped;
}

/** One driving path through the given waypoints, as [lat, lng] pairs. */
async function fetchPath(points: LatLng[]): Promise<Path | null> {
  if (points.length < 2) return null;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM}/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "KanRoute/1.0 (hackathon demo)" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      code?: string;
      routes?: { geometry?: { coordinates?: number[][] } }[];
    };
    if (body.code !== "Ok") return null;
    const coordinates = body.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
    // OSRM speaks [lng, lat]; leaflet wants [lat, lng].
    return thin(coordinates.map(([lng, lat]) => [lat, lng]));
  } catch {
    return null;
  }
}

export const setPaths = internalMutation({
  args: {
    routeId: v.id("routes"),
    roadPath: v.optional(v.array(v.array(v.number()))),
    linkPath: v.optional(v.array(v.array(v.number()))),
  },
  returns: v.null(),
  handler: async (ctx, { routeId, roadPath, linkPath }) => {
    await ctx.db.patch("routes", routeId, { roadPath, linkPath });
    return null;
  },
});

/**
 * Resolve road geometry for every route in a run.
 *
 * Two paths per route: the full pickup sequence, drawn when a route is in
 * focus, and the direct depot-to-zone link, drawn when it is at rest.
 */
export const enrichRun = action({
  args: { runId: v.id("runs") },
  returns: v.object({ resolved: v.number(), total: v.number() }),
  handler: async (ctx, { runId }): Promise<{ resolved: number; total: number }> => {
    const routes = (await ctx.runQuery(api.runs.routes, { runId })) as {
      _id: Id<"routes">;
      shipmentRefs: string[];
    }[];
    const shipments = (await ctx.runQuery(internal.runs.shipmentsForRunInternal, {
      runId,
    })) as {
      reference: string;
      originLat: number;
      originLng: number;
      destLat: number;
      destLng: number;
    }[];

    const byRef = new Map(shipments.map((s) => [s.reference, s]));
    let resolved = 0;

    for (const r of routes) {
      const items = r.shipmentRefs
        .map((ref) => byRef.get(ref))
        .filter((x): x is (typeof shipments)[number] => Boolean(x));
      if (items.length === 0) continue;

      // Deduplicate pickups, then order them nearest-first from the depot.
      // This mirrors the map exactly, so the numbered stops sit on the path.
      const pickups: LatLng[] = [];
      for (const it of items) {
        if (
          !pickups.some((p) => p.lat === it.originLat && p.lng === it.originLng)
        )
          pickups.push({ lat: it.originLat, lng: it.originLng });
      }
      const ordered: LatLng[] = [];
      const remaining = [...pickups];
      let cur: LatLng = DEPOT;
      while (remaining.length) {
        let best = 0;
        let bestD = Infinity;
        remaining.forEach((p, i) => {
          const d = (p.lat - cur.lat) ** 2 + (p.lng - cur.lng) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        cur = remaining.splice(best, 1)[0];
        ordered.push(cur);
      }

      const drop: LatLng = { lat: items[0].destLat, lng: items[0].destLng };

      const roadPath = await fetchPath([DEPOT, ...ordered, drop]);
      await sleep(GAP_MS);
      const linkPath = await fetchPath([DEPOT, drop]);
      await sleep(GAP_MS);

      if (roadPath || linkPath) {
        await ctx.runMutation(internal.roads.setPaths, {
          routeId: r._id,
          roadPath: roadPath ?? undefined,
          linkPath: linkPath ?? undefined,
        });
        if (roadPath) resolved++;
      }
    }

    await ctx.runMutation(internal.events.log, {
      runId,
      provider: "kanroute",
      type: "roads.resolved",
      message:
        resolved === routes.length
          ? `Road geometry resolved for all ${routes.length} routes`
          : `Road geometry resolved for ${resolved}/${routes.length} routes`,
    });

    return { resolved, total: routes.length };
  },
});
