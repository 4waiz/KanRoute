"use client";

import { Fragment, useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
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

const DEPOT = { name: "Al Quoz Consolidation Hub", lat: 25.13, lng: 55.22 };

/**
 * Quadratic bezier between two points, bowed perpendicular to the chord.
 * Routes share endpoints, so straight chords stack into an unreadable
 * starburst. Alternating the bow fans them apart instead.
 */
function curve(a: LatLng, b: LatLng, bend: number, steps = 26): [number, number][] {
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  // Perpendicular of the chord, scaled by the bend factor.
  const ctrl = { lat: mid.lat - dLng * bend, lng: mid.lng + dLat * bend };

  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([
      u * u * a.lat + 2 * u * t * ctrl.lat + t * t * b.lat,
      u * u * a.lng + 2 * u * t * ctrl.lng + t * t * b.lng,
    ]);
  }
  return pts;
}

function stopIcon(color: string, label: string, dim: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};
      opacity:${dim ? 0.22 : 1};
      color:#0b0e10;
      width:19px;height:19px;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font:700 10px/1 ui-sans-serif,system-ui,sans-serif;
      box-shadow:0 0 0 2px rgba(8,9,10,.85);
    ">${label}</div>`,
    iconSize: [19, 19],
    iconAnchor: [9.5, 9.5],
  });
}

function dropIcon(color: string, dim: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:15px;height:15px;
      border-radius:4px;
      background:${color};
      opacity:${dim ? 0.22 : 1};
      transform:rotate(45deg);
      box-shadow:0 0 0 2.5px rgba(8,9,10,.9);
    "></div>`,
    iconSize: [15, 15],
    iconAnchor: [7.5, 7.5],
  });
}

function depotIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:#f2f4f5;color:#0b0e10;
      padding:3px 9px;border-radius:999px;
      font:700 9px/1.4 ui-sans-serif,system-ui,sans-serif;
      letter-spacing:.09em;
      box-shadow:0 2px 10px rgba(0,0,0,.6);
    ">DEPOT</div>`,
    iconSize: [58, 20],
    iconAnchor: [29, 10],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;

    // The map sits in a grid cell that settles after mount, so leaflet
    // measures a stale size and fits to the wrong zoom. Re-measure and refit
    // until the user takes over, then leave their viewport alone.
    let userDriving = false;
    const claim = () => {
      userDriving = true;
    };
    map.on("dragstart", claim);
    map.on("zoomstart", claim);

    const fit = () => {
      map.invalidateSize({ animate: false });
      if (userDriving) return;
      map.fitBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: 12 });
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
      map.off("dragstart", claim);
      map.off("zoomstart", claim);
    };
  }, [map, points]);
  return null;
}

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
  const byRef = useMemo(() => {
    const m = new Map<string, MapShipment>();
    for (const s of shipments) m.set(s.reference, s);
    return m;
  }, [shipments]);

  const built = useMemo(() => {
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

      // Fan successive routes apart, alternating side so they never stack.
      const bend = (i % 2 === 0 ? 1 : -1) * (0.05 + Math.floor(i / 2) * 0.028);

      const legs: [number, number][][] = [];
      let from: LatLng = DEPOT;
      for (const p of ordered) {
        legs.push(curve(from, p, bend));
        from = p;
      }
      legs.push(curve(from, drop, bend));

      return {
        route: r,
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
        pickups: ordered,
        drop,
        legs,
        // Return leg is bowed the other way and drawn faintly.
        returnLeg: curve(drop, DEPOT, -bend * 1.15),
      };
    });
  }, [routes, byRef]);

  const allPoints = useMemo(() => {
    const pts: [number, number][] = [[DEPOT.lat, DEPOT.lng]];
    for (const s of shipments) {
      pts.push([s.originLat, s.originLng]);
      pts.push([s.destLat, s.destLng]);
    }
    return pts;
  }, [shipments]);

  return (
    <MapContainer
      center={[25.15, 55.25]}
      zoom={10}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", borderRadius: 18 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={allPoints} />

      <Marker position={[DEPOT.lat, DEPOT.lng]} icon={depotIcon()} zIndexOffset={600}>
        <Popup>{DEPOT.name}</Popup>
      </Marker>

      {/* Status quo: faint, so the point is the volume of lines, not any one */}
      {!consolidated &&
        shipments.map((s, i) => (
          <Polyline
            key={`b-${s.reference}`}
            positions={[
              ...curve(DEPOT, { lat: s.originLat, lng: s.originLng }, 0.06),
              ...curve(
                { lat: s.originLat, lng: s.originLng },
                { lat: s.destLat, lng: s.destLng },
                i % 2 ? 0.08 : -0.08,
              ),
            ]}
            pathOptions={{
              color: "#93a0a6",
              weight: 1,
              opacity: 0.35,
            }}
          />
        ))}

      {consolidated &&
        built.map((b) => {
          if (visible[b.route.label] === false) return null;
          const dim = selected !== null && selected !== b.route.label;
          const flat = b.legs.flat();

          return (
            <Fragment key={`r-${b.route.label}`}>
              {/* Return to depot, deliberately understated */}
              <Polyline
                positions={b.returnLeg}
                pathOptions={{
                  color: b.color,
                  weight: 1.2,
                  opacity: dim ? 0.06 : 0.28,
                  dashArray: "2 7",
                }}
              />
              {/* Base stroke */}
              <Polyline
                positions={flat}
                pathOptions={{
                  color: b.color,
                  weight: selected === b.route.label ? 5 : 3,
                  opacity: dim ? 0.12 : 0.55,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                eventHandlers={{
                  click: () =>
                    onSelect(selected === b.route.label ? null : b.route.label),
                }}
              >
                <Tooltip sticky>
                  {b.route.zone} · {b.route.distanceKm} km · {b.route.loadKg} kg
                </Tooltip>
              </Polyline>
              {/* Marching dash showing direction of travel */}
              {!dim && (
                <Polyline
                  positions={flat}
                  className={
                    selected === b.route.label ? "kr-flow-fast" : "kr-flow"
                  }
                  pathOptions={{
                    color: b.color,
                    weight: selected === b.route.label ? 3 : 2,
                    opacity: 0.95,
                    dashArray: "10 16",
                    lineCap: "round",
                    interactive: false,
                  }}
                />
              )}
            </Fragment>
          );
        })}

      {consolidated &&
        built.map((b) => {
          if (visible[b.route.label] === false) return null;
          const dim = selected !== null && selected !== b.route.label;
          const showLabel = selected === b.route.label;
          return (
            <Fragment key={`m-${b.route.label}`}>
              {b.pickups.map((p, idx) => (
                <Marker
                  key={`${b.route.label}-p-${idx}`}
                  position={[p.lat, p.lng]}
                  icon={stopIcon(b.color, String(idx + 1), dim)}
                  zIndexOffset={dim ? 0 : 300}
                  eventHandlers={{ click: () => onSelect(b.route.label) }}
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
                icon={dropIcon(b.color, dim)}
                zIndexOffset={dim ? 0 : 400}
                eventHandlers={{ click: () => onSelect(b.route.label) }}
              >
                {/* Labels only when a route is picked, otherwise they collide */}
                <Tooltip
                  className="kr-zone"
                  permanent={showLabel}
                  direction="top"
                  offset={[0, -10]}
                >
                  {b.route.zone}
                </Tooltip>
              </Marker>
            </Fragment>
          );
        })}

      {!consolidated &&
        shipments.map((s) => (
          <CircleMarker
            key={`bp-${s.reference}`}
            center={[s.originLat, s.originLng]}
            radius={3.5}
            pathOptions={{
              color: "#0b0e10",
              fillColor: "#ff7a33",
              fillOpacity: 0.9,
              weight: 1.5,
            }}
          >
            <Tooltip className="kr-zone">
              {s.supplierName} · {s.reference} · {s.weightKg} kg
            </Tooltip>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
