"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { FleetStatus, type Vehicle } from "@/components/Fleet";
import { Panel } from "@/components/Shell";
import { useConsole, useRouteSelection } from "@/components/useConsole";
import { ROUTE_COLORS } from "@/lib/routeColors";

const RouteMap = dynamic(
  () => import("@/components/RouteMap").then((m) => m.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center rounded-[18px] bg-[var(--kf-card-sub)]">
        <span className="text-[12px] text-[var(--kf-ink-3)]">Loading map…</span>
      </div>
    ),
  },
);

export default function Overview() {
  const { stats, routes, shipments, done } = useConsole();
  const { visible, selected, setSelected, mapRoutes, hidden, toggle } =
    useRouteSelection(routes);
  const vehicles = useQuery(api.fleet.list, {}) as Vehicle[] | undefined;
  const dispatchFleet = useMutation(api.fleet.dispatch);
  const resetFleet = useMutation(api.fleet.reset);
  const [busy, setBusy] = useState(false);
  const [consolidated, setConsolidated] = useState(true);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-0 gap-2.5 lg:h-full lg:grid-rows-[auto_minmax(0,1fr)]">
      {/* Only the four numbers that carry the argument. */}
      <div className="grid shrink-0 grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Kpi
          accent
          label="Vans required"
          value={`${stats?.baselineVans ?? 0} → ${stats?.usedVans ?? 0}`}
          sub={`${stats?.vansSaved ?? 0} taken off the road`}
        />
        <Kpi
          label="Distance cut"
          value={`${stats?.kmSavedPct ?? 0}%`}
          sub={`${stats?.kmSaved ?? 0} km not driven`}
        />
        <Kpi
          label="CO2 avoided"
          value={`${stats?.co2SavedKg ?? 0} kg`}
          valueColor="var(--kf-pass)"
        />
        <Kpi
          label="Cost avoided"
          value={`AED ${(stats?.costSavedAed ?? 0).toLocaleString()}`}
          sub={`at AED ${stats?.costRateAed ?? 0}/km`}
        />
      </div>

      <div className="grid min-h-0 gap-2.5 lg:grid-cols-[228px_minmax(0,1fr)_300px]">
        <Panel
          title="Routes"
          right={
            <div className="flex shrink-0 rounded-full bg-[var(--kf-card-sub)] p-0.5">
              <Toggle
                active={!consolidated}
                onClick={() => setConsolidated(false)}
              >
                Before
              </Toggle>
              <Toggle active={consolidated} onClick={() => setConsolidated(true)}>
                After
              </Toggle>
            </div>
          }
          bodyClassName="px-2 pb-2"
        >
          {(routes ?? []).length === 0 ? (
            <div className="px-2 py-8 text-center">
              <div className="relative mx-auto h-1.5 w-28 overflow-hidden rounded-full bg-[var(--kf-card-sub)] kf-sweep" />
              <p className="mt-3 text-[11px] text-[var(--kf-ink-3)]">
                Devin is optimising
              </p>
            </div>
          ) : (
            (routes ?? []).map((r, i) => {
              const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
              const on = !hidden.includes(r.label);
              const isSel = selected === r.label;
              return (
                <div
                  key={r._id}
                  onClick={() => setSelected(isSel ? null : r.label)}
                  className="kf-enter mb-1 cursor-pointer rounded-lg px-2 py-1.5 transition hover:bg-[var(--kf-card-sub)]"
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
                      className="h-3 w-3 shrink-0 accent-[var(--kf-accent)]"
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: color, opacity: on ? 1 : 0.3 }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-semibold text-[var(--kf-ink)]">
                        {r.zone}
                      </span>
                      <span className="block font-mono text-[9.5px] text-[var(--kf-ink-3)]">
                        {r.stopCount}st · {r.loadKg}kg · {r.distanceKm}km
                      </span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </Panel>

        <div className="kf-card min-h-[340px] overflow-hidden p-1.5">
          <RouteMap
            shipments={shipments ?? []}
            routes={mapRoutes}
            consolidated={consolidated && done}
            visible={visible}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        <FleetStatus
          vehicles={vehicles ?? []}
          busy={busy}
          onDispatch={() => act(() => dispatchFleet({}))}
          onReset={() => act(() => resetFleet({}))}
        />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  accent,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  valueColor?: string;
}) {
  if (accent) {
    return (
      <div
        className="rounded-2xl px-4 py-3 text-white shadow-[var(--kf-shadow)]"
        style={{ background: "var(--kf-brand-gradient)" }}
      >
        <div className="text-[11px] font-semibold opacity-90">{label}</div>
        <div className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums">
          {value}
        </div>
        {sub && <div className="mt-1 text-[10px] opacity-80">{sub}</div>}
      </div>
    );
  }
  return (
    <div className="kf-card px-4 py-3">
      <div className="text-[11px] font-semibold text-[var(--kf-ink-2)]">
        {label}
      </div>
      <div
        className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums"
        style={{ color: valueColor ?? "var(--kf-ink)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[10px] text-[var(--kf-ink-3)]">{sub}</div>
      )}
    </div>
  );
}

function Toggle({
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
      className={`rounded-full px-2 py-1 text-[9.5px] font-semibold transition ${
        active
          ? "bg-[var(--kf-card)] text-[var(--kf-ink)] ring-1 ring-[var(--kf-border)]"
          : "text-[var(--kf-ink-3)]"
      }`}
    >
      {children}
    </button>
  );
}
