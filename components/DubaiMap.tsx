"use client";

import { useMemo, useState } from "react";

type Point = { lat: number; lng: number };

export type MapShipment = {
  reference: string;
  supplierName: string;
  destinationZone: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
};

export type MapRoute = {
  label: string;
  zone: string;
  shipmentRefs: string[];
};

const BOUNDS = { minLat: 24.86, maxLat: 25.36, minLng: 54.95, maxLng: 55.52 };
const W = 560;
const H = 400;

const ROUTE_COLORS = [
  "#ff6b2c",
  "#3d8bff",
  "#35c46b",
  "#7c5cd6",
  "#d98324",
  "#e0428f",
];

function project(p: Point) {
  const x = ((p.lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * W;
  // Latitude grows northwards, SVG y grows downwards.
  const y = H - ((p.lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H;
  return { x, y };
}

/**
 * Schematic map of the Dubai operating area. Deliberately not a tile map:
 * every point is a real coordinate from the pipeline, and the schematic keeps
 * attention on the consolidation rather than on cartography.
 */
export function DubaiMap({
  depot,
  shipments,
  routes,
  consolidated,
}: {
  depot: Point & { name: string };
  shipments: MapShipment[];
  routes: MapRoute[];
  consolidated: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const d = project(depot);

  const routeOfShipment = useMemo(() => {
    const m = new Map<string, number>();
    routes.forEach((r, i) => {
      for (const ref of r.shipmentRefs) m.set(ref, i);
    });
    return m;
  }, [routes]);

  const drops = useMemo(() => {
    const seen = new Map<string, { lat: number; lng: number }>();
    for (const s of shipments) {
      if (!seen.has(s.destinationZone)) {
        seen.set(s.destinationZone, { lat: s.destLat, lng: s.destLng });
      }
    }
    return [...seen.entries()].map(([zone, p]) => ({ zone, ...p }));
  }, [shipments]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-[var(--kf-card-sub)]">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M40 0 L0 0 0 40"
              fill="none"
              stroke="rgba(12,18,17,0.05)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />

        {/* Coastline hint: Dubai's shore runs roughly NE to SW. */}
        <path
          d={`M ${project({ lat: 25.36, lng: 55.34 }).x} ${project({ lat: 25.36, lng: 55.34 }).y}
              L ${project({ lat: 25.2, lng: 55.24 }).x} ${project({ lat: 25.2, lng: 55.24 }).y}
              L ${project({ lat: 25.05, lng: 55.11 }).x} ${project({ lat: 25.05, lng: 55.11 }).y}
              L ${project({ lat: 24.94, lng: 54.98 }).x} ${project({ lat: 24.94, lng: 54.98 }).y}`}
          fill="none"
          stroke="rgba(61,139,255,0.28)"
          strokeWidth="2"
          strokeDasharray="6 5"
        />

        {/* Legs */}
        {shipments.map((s) => {
          const o = project({ lat: s.originLat, lng: s.originLng });
          const t = project({ lat: s.destLat, lng: s.destLng });
          const idx = routeOfShipment.get(s.reference);
          const color =
            consolidated && idx !== undefined
              ? ROUTE_COLORS[idx % ROUTE_COLORS.length]
              : "rgba(12,18,17,0.22)";
          const active = hover === s.reference;
          return (
            <g key={s.reference}>
              {!consolidated && (
                <path
                  d={`M ${d.x} ${d.y} L ${o.x} ${o.y} L ${t.x} ${t.y} L ${d.x} ${d.y}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={active ? 2 : 1}
                  opacity={active ? 0.9 : 0.45}
                />
              )}
              {consolidated && (
                <path
                  d={`M ${o.x} ${o.y} L ${t.x} ${t.y}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={active ? 3 : 2}
                  opacity={active ? 1 : 0.75}
                  strokeLinecap="round"
                />
              )}
            </g>
          );
        })}

        {/* Depot legs for consolidated routes */}
        {consolidated &&
          routes.map((r, i) => {
            const first = shipments.find((s) => r.shipmentRefs.includes(s.reference));
            if (!first) return null;
            const o = project({ lat: first.originLat, lng: first.originLng });
            const t = project({ lat: first.destLat, lng: first.destLng });
            const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
            return (
              <g key={r.label}>
                <path
                  d={`M ${d.x} ${d.y} L ${o.x} ${o.y}`}
                  stroke={color}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.5"
                  fill="none"
                />
                <path
                  d={`M ${t.x} ${t.y} L ${d.x} ${d.y}`}
                  stroke={color}
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  opacity="0.5"
                  fill="none"
                />
              </g>
            );
          })}

        {/* Drop zones */}
        {drops.map((z) => {
          const p = project(z);
          return (
            <g key={z.zone}>
              <circle cx={p.x} cy={p.y} r="9" fill="rgba(12,18,17,0.06)" />
              <circle cx={p.x} cy={p.y} r="4.5" fill="var(--kf-ink)" />
              <text
                x={p.x}
                y={p.y - 13}
                textAnchor="middle"
                className="fill-[var(--kf-ink-2)] text-[9px] font-semibold"
              >
                {z.zone}
              </text>
            </g>
          );
        })}

        {/* Pickups */}
        {shipments.map((s) => {
          const o = project({ lat: s.originLat, lng: s.originLng });
          return (
            <circle
              key={`p-${s.reference}`}
              cx={o.x}
              cy={o.y}
              r={hover === s.reference ? 6 : 4}
              fill="var(--kf-accent)"
              stroke="#fff"
              strokeWidth="1.5"
              onMouseEnter={() => setHover(s.reference)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            />
          );
        })}

        {/* Depot */}
        <g>
          <rect
            x={d.x - 7}
            y={d.y - 7}
            width="14"
            height="14"
            rx="3.5"
            fill="var(--kf-ink)"
          />
          <text
            x={d.x}
            y={d.y + 22}
            textAnchor="middle"
            className="fill-[var(--kf-ink-2)] text-[9px] font-semibold"
          >
            DEPOT
          </text>
        </g>
      </svg>

      <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 text-[10px] text-[var(--kf-ink-2)]">
        <Legend color="var(--kf-accent)" label="Supplier pickup" />
        <Legend color="var(--kf-ink)" label="Drop zone" />
        {consolidated && <Legend color="#3d8bff" label="Consolidated route" />}
      </div>
      {hover && (
        <div className="absolute right-3 top-3 rounded-xl bg-[var(--kf-ink)] px-3 py-2 text-[11px] text-white">
          {shipments.find((s) => s.reference === hover)?.supplierName} to{" "}
          {shipments.find((s) => s.reference === hover)?.destinationZone}
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
