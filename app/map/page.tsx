"use client";

import { useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Vehicle } from "@/components/Fleet";
import { Panel } from "@/components/Shell";
import { useConsole, useRouteSelection } from "@/components/useConsole";
import { ROUTE_COLORS } from "@/lib/routeColors";

const RouteMap = dynamic(
  () => import("@/components/RouteMap").then((m) => m.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center rounded-[16px] bg-[var(--kf-card-sub)]">
        <span className="text-[12px] text-[var(--kf-ink-3)]">Loading map…</span>
      </div>
    ),
  },
);

export default function MapView() {
  const { routes, shipments, done, stats } = useConsole();
  const { visible, selected, setSelected, mapRoutes, hidden, setHidden, toggle } =
    useRouteSelection(routes);
  const fleet = useQuery(api.fleet.list, {}) as Vehicle[] | undefined;
  const [consolidated, setConsolidated] = useState(true);

  const allHidden = (routes ?? []).length > 0 && hidden.length === routes?.length;

  return (
    <div className="grid min-h-0 gap-2.5 lg:h-full lg:grid-cols-[300px_minmax(0,1fr)]">
      <Panel
        title="Route layers"
        sub={`${(routes ?? []).length} routes · ${shipments?.length ?? 0} consignments`}
        right={
          <button
            onClick={() =>
              setHidden(allHidden ? [] : (routes ?? []).map((r) => r.label))
            }
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--kf-card-sub)] px-2 py-1 text-[9.5px] font-semibold text-[var(--kf-ink-2)]"
          >
            {allHidden ? (
              <Eye className="h-3 w-3" />
            ) : (
              <EyeOff className="h-3 w-3" />
            )}
            {allHidden ? "Show all" : "Hide all"}
          </button>
        }
        bodyClassName="px-2 pb-2"
      >
        <div className="mb-2 flex rounded-full bg-[var(--kf-card-sub)] p-0.5">
          <Seg active={!consolidated} onClick={() => setConsolidated(false)}>
            Before ({stats?.baselineVans ?? 0} vans)
          </Seg>
          <Seg active={consolidated} onClick={() => setConsolidated(true)}>
            After ({stats?.usedVans ?? 0} routes)
          </Seg>
        </div>

        {(routes ?? []).map((r, i) => {
          const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
          const on = !hidden.includes(r.label);
          const isSel = selected === r.label;
          return (
            <div
              key={r._id}
              onClick={() => setSelected(isSel ? null : r.label)}
              className="kf-enter mb-1 cursor-pointer rounded-lg px-2.5 py-2 transition hover:bg-[var(--kf-card-sub)]"
              style={
                isSel
                  ? {
                      background: "var(--kf-card-sub)",
                      boxShadow: `inset 0 0 0 1.5px ${color}`,
                    }
                  : {}
              }
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(r.label)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 shrink-0 accent-[var(--kf-accent)]"
                />
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white"
                  style={{ background: color, opacity: on ? 1 : 0.3 }}
                >
                  {r.label.replace(/[^0-9]/g, "") || r.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--kf-ink)]">
                  {r.zone}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 pl-[26px] font-mono text-[9.5px] text-[var(--kf-ink-3)]">
                <span>{r.stopCount} stops</span>
                <span>·</span>
                <span>{r.loadKg} kg</span>
                <span>·</span>
                <span>{r.distanceKm} km</span>
                <span
                  className="rounded px-1"
                  style={{
                    background: `color-mix(in srgb, ${color} 16%, var(--kf-mix))`,
                    color,
                  }}
                >
                  {r.windowStart}-{r.windowEnd}
                </span>
              </div>
              {isSel && (
                <div className="mt-1.5 pl-[26px] font-mono text-[9.5px] text-[var(--kf-ink-2)]">
                  {r.shipmentRefs.join(" · ")}
                </div>
              )}
            </div>
          );
        })}

        {(routes ?? []).length === 0 && (
          <p className="px-2 py-6 text-center text-[11.5px] text-[var(--kf-ink-3)]">
            No routes yet. Run a consolidation.
          </p>
        )}
      </Panel>

      <div className="kf-card min-h-[360px] overflow-hidden p-1.5">
        <RouteMap
          shipments={shipments ?? []}
          routes={mapRoutes}
          vehicles={fleet ?? []}
          consolidated={consolidated && done}
          visible={visible}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </div>
  );
}

function Seg({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full px-2 py-1.5 text-[10px] font-semibold transition ${
        active
          ? "bg-[var(--kf-card)] text-[var(--kf-ink)] ring-1 ring-[var(--kf-border)]"
          : "text-[var(--kf-ink-3)]"
      }`}
    >
      {children}
    </button>
  );
}
