"use client";

import "leaflet/dist/leaflet.css";
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



const DEPOT = { name: "Al Quoz Consolidation Hub", lat: 25.13, lng: 55.22 };

/** Numbered stop pin, coloured per route, like a routing console. */
function stopIcon(color: string, label: string, dim: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};
      opacity:${dim ? 0.28 : 1};
      color:#fff;
      width:22px;height:22px;
      border-radius:6px;
      display:flex;align-items:center;justify-content:center;
      font:600 11px/1 ui-sans-serif,system-ui,sans-serif;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
      border:1.5px solid #fff;
    ">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function depotIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      background:#0c1211;color:#fff;
      padding:3px 8px;border-radius:7px;
      font:700 10px/1.4 ui-sans-serif,system-ui,sans-serif;
      letter-spacing:.08em;
      box-shadow:0 2px 8px rgba(0,0,0,.4);
      border:1.5px solid #fff;
    ">DEPOT</div>`,
    iconSize: [56, 20],
    iconAnchor: [28, 10],
  });
}

/** Keeps the viewport fitted to whatever is currently plotted. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 12 });
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

  /** Depot -> unique pickups -> drop -> depot, in nearest-neighbour order. */
  const built = useMemo(() => {
    return routes.map((r, i) => {
      const items = r.shipmentRefs
        .map((ref) => byRef.get(ref))
        .filter((x): x is MapShipment => Boolean(x));

      const pickups: { lat: number; lng: number; names: string[] }[] = [];
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

      const ordered: typeof pickups = [];
      const remaining = [...pickups];
      let cur = { lat: DEPOT.lat, lng: DEPOT.lng };
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
        cur = { lat: next.lat, lng: next.lng };
      }

      const drop = items[0]
        ? { lat: items[0].destLat, lng: items[0].destLng }
        : { lat: DEPOT.lat, lng: DEPOT.lng };

      const path: [number, number][] = [
        [DEPOT.lat, DEPOT.lng],
        ...ordered.map((p) => [p.lat, p.lng] as [number, number]),
        [drop.lat, drop.lng],
        [DEPOT.lat, DEPOT.lng],
      ];

      return {
        route: r,
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
        pickups: ordered,
        drop,
        path,
        items,
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

      <Marker position={[DEPOT.lat, DEPOT.lng]} icon={depotIcon()}>
        <Popup>{DEPOT.name}</Popup>
      </Marker>

      {/* Status quo: every consignment its own out-and-back leg. */}
      {!consolidated &&
        shipments.map((s) => (
          <Polyline
            key={`b-${s.reference}`}
            positions={[
              [DEPOT.lat, DEPOT.lng],
              [s.originLat, s.originLng],
              [s.destLat, s.destLng],
              [DEPOT.lat, DEPOT.lng],
            ]}
            pathOptions={{
              color: "#8b9895",
              weight: 1.4,
              opacity: 0.5,
              dashArray: "4 4",
            }}
          />
        ))}

      {consolidated &&
        built.map((b) => {
          if (visible[b.route.label] === false) return null;
          const dim = selected !== null && selected !== b.route.label;
          return (
            <Polyline
              key={`r-${b.route.label}`}
              positions={b.path}
              pathOptions={{
                color: b.color,
                weight: selected === b.route.label ? 6 : 4,
                opacity: dim ? 0.2 : 0.9,
                lineJoin: "round",
              }}
              eventHandlers={{
                click: () =>
                  onSelect(selected === b.route.label ? null : b.route.label),
              }}
            >
              <Tooltip sticky>
                {b.route.label} · {b.route.zone} · {b.route.distanceKm} km
              </Tooltip>
            </Polyline>
          );
        })}

      {consolidated &&
        built.map((b) => {
          if (visible[b.route.label] === false) return null;
          const dim = selected !== null && selected !== b.route.label;
          return (
            <Fragment key={`m-${b.route.label}`}>
              {b.pickups.map((p, idx) => (
                <Marker
                  key={`${b.route.label}-p-${idx}`}
                  position={[p.lat, p.lng]}
                  icon={stopIcon(b.color, String(idx + 1), dim)}
                  eventHandlers={{ click: () => onSelect(b.route.label) }}
                >
                  <Popup>
                    <strong>
                      {b.route.label} stop {idx + 1}
                    </strong>
                    <br />
                    {p.names.join(", ")}
                  </Popup>
                </Marker>
              ))}
              <CircleMarker
                center={[b.drop.lat, b.drop.lng]}
                radius={9}
                pathOptions={{
                  color: "#0c1211",
                  fillColor: b.color,
                  fillOpacity: dim ? 0.25 : 1,
                  weight: 2,
                }}
                eventHandlers={{ click: () => onSelect(b.route.label) }}
              >
                <Tooltip permanent direction="top" offset={[0, -10]}>
                  {b.route.zone}
                </Tooltip>
              </CircleMarker>
            </Fragment>
          );
        })}

      {/* Pickup dots in baseline view */}
      {!consolidated &&
        shipments.map((s) => (
          <CircleMarker
            key={`bp-${s.reference}`}
            center={[s.originLat, s.originLng]}
            radius={5}
            pathOptions={{
              color: "#fff",
              fillColor: "#ff6b2c",
              fillOpacity: 1,
              weight: 1.5,
            }}
          >
            <Tooltip>
              {s.supplierName} · {s.reference} · {s.weightKg} kg
            </Tooltip>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
