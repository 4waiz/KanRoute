"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Pane,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { ROUTE_COLORS } from "@/lib/routeColors";

export type MapShipment = {
  reference: string;
  supplierName: string;
  destinationZone: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  weightKg: number;
  windowStart: string;
  windowEnd: string;
};

export type MapRoute = {
  label: string;
  zone: string;
  shipmentRefs: string[];
  distanceKm: number;
  loadKg: number;
};

type LatLng = { lat: number; lng: number };
type XY = { x: number; y: number };

const DEPOT = { name: "Al Quoz Consolidation Hub", lat: 25.13, lng: 55.22 };

/**
 * Esri's dark canvas is a purpose-built dark basemap served without an API
 * key. It replaces an inverted OpenStreetMap layer, which flattened Dubai
 * into a near-black slab and left every route looking pasted onto a dark
 * rectangle rather than drawn on a map.
 */
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const BASE_URL = `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const LABEL_URL = `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;
const ATTRIB = "Esri, HERE, Garmin, &copy; OpenStreetMap contributors";

/**
 * Explicit layer order. Leaflet reserves 200 tiles, 400 overlay, 600 marker
 * and 650 tooltip, so every custom pane stays below the marker pane and a
 * route can never bury a stop.
 */
const P_LABELS = "kr-labels";
const P_CASING = "kr-casing";
const P_ROUTE = "kr-route";
const P_ACTIVE = "kr-active";

/* ---------------------------------------------------------------- geometry */

/**
 * Route geometry is computed in a local equirectangular frame measured in
 * kilometres. A lane offset is then a real distance on the ground instead of
 * a number of degrees, which would stretch differently along latitude and
 * longitude and let parallel lanes drift apart across the map.
 */
const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LNG = 111.32 * Math.cos((25.15 * Math.PI) / 180);

const toXY = (p: LatLng): XY => ({
  x: p.lng * KM_PER_DEG_LNG,
  y: p.lat * KM_PER_DEG_LAT,
});
const toLatLng = (p: XY): [number, number] => [
  p.y / KM_PER_DEG_LAT,
  p.x / KM_PER_DEG_LNG,
];

/** Departure fan angle at the depot. */
const GATE_SPREAD = (9 * Math.PI) / 180;

/**
 * Lane separation is a fraction of the plan's own extent rather than a fixed
 * distance. A 400 m lane reads clearly on a plan covering one district and
 * disappears on one spanning the emirate; scaling it keeps the separation
 * looking identical either way.
 */
function laneWidthKm(pts: XY[]): number {
  if (pts.length === 0) return 0.5;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const diag = Math.hypot(maxX - minX, maxY - minY) || 20;
  return Math.min(Math.max(diag * 0.015, 0.35), 2.2);
}

const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: XY, b: XY): XY => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: XY, k: number): XY => ({ x: a.x * k, y: a.y * k });
const norm = (a: XY) => Math.hypot(a.x, a.y);

/**
 * Straight legs with filleted corners.
 *
 * A spline through unevenly spaced stops overshoots badly: a 2 km hop out of
 * the depot followed by a 20 km run gives the first control point an enormous
 * tangent, and the route balloons into a loop no vehicle would ever drive. A
 * quadratic fillet is bounded by its own corner, so the line always stays on
 * the legs it is meant to follow while still reading as a curve.
 */
function roundCorners(pts: XY[], radiusKm = 2.4, steps = 9): XY[] {
  if (pts.length < 3) return pts.slice();
  const out: XY[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const c = pts[i];
    const v1 = sub(pts[i - 1], c);
    const v2 = sub(pts[i + 1], c);
    const l1 = norm(v1);
    const l2 = norm(v2);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    // Never eat more than a bit under half of either adjacent leg, so the
    // fillet cannot swallow a short hop entirely.
    const r = Math.min(radiusKm, l1 * 0.42, l2 * 0.42);
    const a = add(c, scale(v1, r / l1));
    const b = add(c, scale(v2, r / l2));
    out.push(a);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      out.push({
        x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
      });
    }
    out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Shift a path sideways onto its own lane. The offset tapers to zero at both
 * ends, so routes still meet the depot and their drop point exactly and only
 * separate along the corridor in between. Near-identical paths become
 * readable without any stop being moved off its real location.
 */
function offsetPath(pts: XY[], km: number): XY[] {
  if (km === 0 || pts.length < 2) return pts;
  const n = pts.length;
  // Taper by distance travelled rather than by index: fillets pack many
  // points into corners, so an index-based taper would peak in the wrong
  // place and pull the widest part of the lane into a bend.
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + norm(sub(pts[i], pts[i - 1])));
  const total = cum[n - 1] || 1;
  return pts.map((pt, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = km * Math.sin(Math.PI * (cum[i] / total));
    return { x: pt.x + (-dy / len) * k, y: pt.y + (dx / len) * k };
  });
}

/**
 * A departure point a short way out from the depot, rotated per lane. Every
 * route still starts on the depot pin, but they leave along different
 * bearings instead of stacking on the same few pixels. The hop is scaled to
 * the leg that follows it so a short route never departs on a hairpin.
 */
function depotGate(target: XY, lane: number): XY {
  const d = toXY(DEPOT);
  const dx = target.x - d.x;
  const dy = target.y - d.y;
  const dist = Math.hypot(dx, dy) || 1;
  const hop = Math.min(Math.max(dist * 0.22, 1.2), 4.5);
  const ang = Math.atan2(dy, dx) + lane * GATE_SPREAD;
  return { x: d.x + Math.cos(ang) * hop, y: d.y + Math.sin(ang) * hop };
}

/* ------------------------------------------------------------------- icons */

/**
 * Icons are immutable, so build each distinct one once. Rebuilding them per
 * render makes leaflet replace every marker element on hover.
 */
const iconCache = new Map<string, L.DivIcon>();
function cached(key: string, make: () => L.DivIcon): L.DivIcon {
  let ic = iconCache.get(key);
  if (!ic) {
    ic = make();
    iconCache.set(key, ic);
  }
  return ic;
}

type Emphasis = "full" | "quiet" | "dim";

/**
 * Numbered pin when its route is in focus, plain dot otherwise: stop sequence
 * is only worth reading on the route you are actually looking at.
 */
function stopIcon(color: string, label: string, mode: Emphasis) {
  return cached(`s|${color}|${label}|${mode}`, () => {
    if (mode === "full") {
      return L.divIcon({
        className: "",
        html: `<div class="kr-pin" style="--c:${color}">${label}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    }
    return L.divIcon({
      className: "",
      html: `<div class="kr-dot" style="--c:${color};opacity:${
        mode === "dim" ? 0.3 : 0.85
      }"></div>`,
      iconSize: [9, 9],
      iconAnchor: [4.5, 4.5],
    });
  });
}

function dropIcon(color: string, mode: Emphasis) {
  return cached(`d|${color}|${mode}`, () =>
    L.divIcon({
      className: "",
      html: `<div class="kr-drop${
        mode === "full" ? " kr-drop-on" : ""
      }" style="--c:${color};opacity:${mode === "dim" ? 0.32 : 1}"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    }),
  );
}

const depotIcon = () =>
  cached("depot", () =>
    L.divIcon({
      className: "",
      html: `<div class="kr-depot"><span class="kr-depot-ring"></span><span class="kr-depot-tag">DEPOT</span></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
  );

/* ----------------------------------------------------------------- viewport */

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;

    // The map sits in a grid cell that settles after mount, so leaflet
    // measures a stale size and fits to the wrong zoom. Re-measure and refit
    // until the user takes over, then leave their viewport alone.
    // Leaflet fires dragstart/zoomstart for programmatic moves too, so the
    // first fitBounds would flag itself as user input and suppress every
    // later fit. Listen for genuine pointer and wheel input instead.
    let userDriving = false;
    const claim = () => {
      userDriving = true;
    };
    const el = map.getContainer();
    el.addEventListener("pointerdown", claim, { passive: true });
    el.addEventListener("wheel", claim, { passive: true });

    // Each fitBounds moves the viewport and makes leaflet request a fresh set
    // of tiles. Refitting an already-settled layout three times therefore
    // triples the tile traffic and leaves the map blank for longer, so only
    // refit when the container has genuinely changed size.
    let lastSize = "";
    const fit = () => {
      map.invalidateSize({ animate: false });
      if (userDriving) return;
      const size = map.getSize();
      const sig = `${size.x}x${size.y}`;
      if (sig === lastSize) return;
      lastSize = sig;
      map.fitBounds(L.latLngBounds(points), { padding: [38, 38], maxZoom: 14 });
    };

    fit();
    const timers = [120, 420, 900].map((ms) => window.setTimeout(fit, ms));

    let debounce = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(fit, 90);
    });
    ro.observe(map.getContainer());

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(debounce);
      ro.disconnect();
      el.removeEventListener("pointerdown", claim);
      el.removeEventListener("wheel", claim);
    };
  }, [map, points]);
  return null;
}

/* ---------------------------------------------------------------- component */

export function RouteMap({
  shipments,
  routes,
  consolidated,
  visible,
  selected,
  onSelect,
}: {
  shipments: MapShipment[];
  routes: MapRoute[];
  consolidated: boolean;
  visible: Record<string, boolean>;
  selected: string | null;
  onSelect: (label: string | null) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  // Hover previews a selection without committing to one, so both run through
  // the same highlight path and the map never shows two competing emphases.
  const focus = hovered ?? selected;

  const byRef = useMemo(() => {
    const m = new Map<string, MapShipment>();
    for (const s of shipments) m.set(s.reference, s);
    return m;
  }, [shipments]);

  // How far apart this plan actually spreads, used to size the lanes.
  const laneKm = useMemo(
    () =>
      laneWidthKm([
        toXY(DEPOT),
        ...shipments.flatMap((s) => [
          toXY({ lat: s.originLat, lng: s.originLng }),
          toXY({ lat: s.destLat, lng: s.destLng }),
        ]),
      ]),
    [shipments],
  );

  const built = useMemo(() => {
    const n = routes.length;
    return routes.map((r, i) => {
      const items = r.shipmentRefs
        .map((ref) => byRef.get(ref))
        .filter((x): x is MapShipment => Boolean(x));

      const pickups: (LatLng & { names: string[] })[] = [];
      for (const it of items) {
        const found = pickups.find(
          (p) => p.lat === it.originLat && p.lng === it.originLng,
        );
        if (found) found.names.push(`${it.supplierName} ${it.reference}`);
        else
          pickups.push({
            lat: it.originLat,
            lng: it.originLng,
            names: [`${it.supplierName} ${it.reference}`],
          });
      }

      // Nearest-neighbour ordering from the depot.
      const ordered: typeof pickups = [];
      const remaining = [...pickups];
      let cur: LatLng = DEPOT;
      while (remaining.length) {
        let best = 0;
        let bestD = Infinity;
        remaining.forEach((p, idx) => {
          const d = (p.lat - cur.lat) ** 2 + (p.lng - cur.lng) ** 2;
          if (d < bestD) {
            bestD = d;
            best = idx;
          }
        });
        const next = remaining.splice(best, 1)[0];
        ordered.push(next);
        cur = next;
      }

      const drop: LatLng = items[0]
        ? { lat: items[0].destLat, lng: items[0].destLng }
        : DEPOT;

      // A stable lane per route index, centred on zero so the bundle stays
      // balanced around the corridor it actually follows.
      const lane = n > 1 ? i - (n - 1) / 2 : 0;

      const stopsXY = ordered.map(toXY);
      const dropXY = toXY(drop);
      const outward = stopsXY[0] ?? dropXY;

      const legs = offsetPath(
        roundCorners([toXY(DEPOT), depotGate(outward, lane), ...stopsXY, dropXY]),
        lane * laneKm,
      ).map(toLatLng);

      const returnLeg = offsetPath(
        roundCorners([dropXY, depotGate(dropXY, -lane), toXY(DEPOT)]),
        -lane * laneKm * 0.8,
      ).map(toLatLng);

      return {
        route: r,
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
        pickups: ordered,
        drop,
        legs,
        returnLeg,
      };
    });
  }, [routes, byRef, laneKm]);

  // One dedicated van per consignment: the status quo this product exists to
  // replace. The tangle is the argument, so it is drawn plainly and faintly.
  const baseline = useMemo(
    () =>
      shipments.map((s, i) => ({
        ref: s.reference,
        shipment: s,
        positions: offsetPath(
          roundCorners([
            toXY(DEPOT),
            toXY({ lat: s.originLat, lng: s.originLng }),
            toXY({ lat: s.destLat, lng: s.destLng }),
          ]),
          ((i % 7) - 3) * 0.45,
        ).map(toLatLng),
      })),
    [shipments],
  );

  // Bounds come from the geometry actually drawn. Smoothed, lane-offset
  // routes swing outside the straight-line box between their endpoints, so
  // fitting to endpoints alone pushes part of every curve off screen.
  const allPoints = useMemo(() => {
    const pts: [number, number][] = [[DEPOT.lat, DEPOT.lng]];
    if (consolidated) {
      for (const b of built) {
        if (visible[b.route.label] === false) continue;
        pts.push(...b.legs);
      }
      // Every layer hidden: fall through to the consignments so the viewport
      // still lands on Dubai rather than the whole world.
      if (pts.length > 1) return pts;
    }
    for (const s of shipments) {
      pts.push([s.originLat, s.originLng]);
      pts.push([s.destLat, s.destLng]);
    }
    return pts;
  }, [shipments, built, consolidated, visible]);

  const drawn = consolidated
    ? built.filter((b) => visible[b.route.label] !== false)
    : [];
  const active = drawn.find((b) => b.route.label === focus);
  const resting = drawn.filter((b) => b.route.label !== focus);

  function hoverProps(label: string) {
    return {
      click: () => onSelect(selected === label ? null : label),
      mouseover: () => setHovered(label),
      mouseout: () => setHovered(null),
    };
  }

  return (
    <div className="kr-map relative h-full w-full overflow-hidden rounded-[16px]">
      <MapContainer
        center={[25.15, 55.25]}
        zoom={10}
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
        /* Leaflet snaps fitBounds down to a whole zoom level by default, which
           left the plan filling barely half the panel with dead map around it.
           Fractional zoom lets the fit actually reach the padding. */
        zoomSnap={0.25}
        style={{ height: "100%", width: "100%" }}
      >
        {/* A ring of off-screen tiles keeps panning from flashing empty. */}
        <TileLayer url={BASE_URL} attribution={ATTRIB} keepBuffer={3} />
        {/* Place names sit above the basemap but below the routes, so they
            give context without competing with the plan. */}
        <Pane name={P_LABELS} style={{ zIndex: 350 }}>
          <TileLayer url={LABEL_URL} keepBuffer={3} />
        </Pane>

        <FitBounds points={allPoints} />

        {/* Status quo: uniform, faint, unlabelled. The volume is the point. */}
        {!consolidated &&
          baseline.map((b) => (
            <Polyline
              key={`b-${b.ref}`}
              positions={b.positions}
              pathOptions={{
                color: "#8d99a0",
                weight: 1.1,
                opacity: 0.4,
                lineCap: "round",
                lineJoin: "round",
              }}
            >
              <Tooltip className="kr-zone" sticky>
                {b.shipment.supplierName} · {b.shipment.reference} ·{" "}
                {b.shipment.weightKg} kg
              </Tooltip>
            </Polyline>
          ))}

        {/* Casing under every resting route. A dark outline is what stops
            crossings reading as one tangled mesh. */}
        <Pane name={P_CASING} style={{ zIndex: 405 }}>
          {resting.map((b) => (
            <Polyline
              key={`c-${b.route.label}`}
              positions={b.legs}
              interactive={false}
              pathOptions={{
                color: "#080a0c",
                weight: focus ? 4.4 : 5.6,
                opacity: focus ? 0.34 : 0.62,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          ))}
        </Pane>

        <Pane name={P_ROUTE} style={{ zIndex: 410 }}>
          {resting.map((b) => (
            <Polyline
              key={`r-${b.route.label}`}
              positions={b.legs}
              pathOptions={{
                color: b.color,
                weight: focus ? 1.9 : 2.6,
                opacity: focus ? 0.28 : 0.82,
                lineCap: "round",
                lineJoin: "round",
              }}
              eventHandlers={hoverProps(b.route.label)}
            >
              <Tooltip className="kr-zone" sticky>
                {b.route.zone} · {b.route.distanceKm} km · {b.route.loadKg} kg
              </Tooltip>
            </Polyline>
          ))}
        </Pane>

        {/* The focused route, in its own pane so it is above every other line
            regardless of the order routes happen to arrive in. */}
        <Pane name={P_ACTIVE} style={{ zIndex: 440 }}>
          {active && (
            <Fragment key={`a-${active.route.label}`}>
              <Polyline
                positions={active.returnLeg}
                interactive={false}
                pathOptions={{
                  color: active.color,
                  weight: 1.3,
                  opacity: 0.4,
                  dashArray: "2 7",
                  lineCap: "round",
                }}
              />
              <Polyline
                positions={active.legs}
                interactive={false}
                pathOptions={{
                  color: "#080a0c",
                  weight: 8,
                  opacity: 0.7,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              <Polyline
                positions={active.legs}
                pathOptions={{
                  color: active.color,
                  weight: 4.2,
                  opacity: 1,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                eventHandlers={hoverProps(active.route.label)}
              >
                <Tooltip className="kr-zone" sticky>
                  {active.route.zone} · {active.route.distanceKm} km ·{" "}
                  {active.route.loadKg} kg
                </Tooltip>
              </Polyline>
              {/* Direction of travel, only on the route being read. */}
              <Polyline
                positions={active.legs}
                className="kr-flow"
                interactive={false}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  opacity: 0.5,
                  dashArray: "9 18",
                  lineCap: "round",
                }}
              />
            </Fragment>
          )}
        </Pane>

        {/* Markers live in leaflet's marker pane, above every route line. */}
        {consolidated &&
          drawn.map((b) => {
            const mode: Emphasis =
              b.route.label === focus ? "full" : focus ? "dim" : "quiet";
            return (
              <Fragment key={`m-${b.route.label}`}>
                {b.pickups.map((p, idx) => (
                  <Marker
                    key={`${b.route.label}-p-${idx}`}
                    position={[p.lat, p.lng]}
                    icon={stopIcon(b.color, String(idx + 1), mode)}
                    zIndexOffset={mode === "full" ? 400 : 0}
                    eventHandlers={hoverProps(b.route.label)}
                  >
                    <Popup>
                      <strong>
                        {b.route.label} · stop {idx + 1}
                      </strong>
                      <br />
                      {p.names.join(", ")}
                    </Popup>
                  </Marker>
                ))}
                <Marker
                  position={[b.drop.lat, b.drop.lng]}
                  icon={dropIcon(b.color, mode)}
                  zIndexOffset={mode === "full" ? 500 : 100}
                  eventHandlers={hoverProps(b.route.label)}
                >
                  {/* Zone names only pin for the focused route; shown all at
                      once they overlap into an unreadable stack. */}
                  <Tooltip
                    className="kr-zone"
                    permanent={mode === "full"}
                    direction="top"
                    offset={[0, -11]}
                  >
                    {b.route.zone}
                  </Tooltip>
                </Marker>
              </Fragment>
            );
          })}

        {!consolidated &&
          baseline.map((b) => (
            <Marker
              key={`bp-${b.ref}`}
              position={[b.shipment.originLat, b.shipment.originLng]}
              icon={stopIcon("#8d99a0", "", "quiet")}
              zIndexOffset={0}
            />
          ))}

        {/* Drawn last so the anchor of the whole network sits on top. */}
        <Marker
          position={[DEPOT.lat, DEPOT.lng]}
          icon={depotIcon()}
          zIndexOffset={900}
        >
          <Popup>{DEPOT.name}</Popup>
        </Marker>

        <ZoomControl position="topright" />
      </MapContainer>

      <div className="kr-legend">
        <span>
          <i className="kr-key-depot" />
          Depot
        </span>
        <span>
          <i className="kr-key-stop" />
          Pickup
        </span>
        <span>
          <i className="kr-key-drop" />
          Drop
        </span>
      </div>
      <div className="kr-attrib">Esri · HERE · Garmin · OpenStreetMap</div>
    </div>
  );
}
