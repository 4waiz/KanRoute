"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { FleetStatus, type Vehicle } from "@/components/Fleet";
import {
  ConsolidationFlow,
  DisruptionPanel,
  LiveState,
  WhyPanel,
} from "@/components/Ops";
import { Panel } from "@/components/Shell";
import { Tour } from "@/components/Tour";
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

export default function Overview() {
  const { stats, latest, routes, shipments, events, done } = useConsole();
  const { visible, selected, setSelected, mapRoutes, hidden, toggle } =
    useRouteSelection(routes);
  const vehicles = useQuery(api.fleet.list, {}) as Vehicle[] | undefined;
  const scenarios = useQuery(api.disruption.scenarios, {}) as
    | { id: string; label: string; detail: string }[]
    | undefined;

  const dispatchFleet = useMutation(api.fleet.dispatch);
  const resetFleet = useMutation(api.fleet.reset);
  const disrupt = useMutation(api.disruption.trigger);

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

  const selectedRoute = (routes ?? []).find((r) => r.label === selected);

  return (
    <div className="grid min-h-0 gap-2.5 lg:h-full lg:grid-rows-[auto_minmax(0,1fr)_minmax(0,158px)]">
      {/* Before -> Optimise -> After, with the supporting numbers */}
      <div
        data-tour="headline"
        className="grid shrink-0 gap-2.5 xl:grid-cols-[minmax(0,1fr)_repeat(3,132px)]"
      >
        <ConsolidationFlow
          status={latest?.status}
          baselineVans={stats?.baselineVans ?? 0}
          usedVans={stats?.usedVans ?? 0}
          companies={latest?.companiesServed ?? stats?.suppliersMapped ?? 0}
          consignments={stats?.consignments ?? 0}
          detail={latest?.devinStatusDetail?.replace(/_/g, " ")}
        />
        <Mini
          label="Distance cut"
          value={`${stats?.kmSavedPct ?? 0}%`}
          sub={`${stats?.kmSaved ?? 0} km`}
        />
        <Mini
          label="CO2 avoided"
          value={`${stats?.co2SavedKg ?? 0} kg`}
          color="var(--kf-pass)"
        />
        <Mini
          label="Cost avoided"
          value={`AED ${(stats?.costSavedAed ?? 0).toLocaleString()}`}
          sub={`at AED ${stats?.costRateAed ?? 0}/km`}
        />
      </div>

      {/* Routes, map, fleet */}
      <div className="grid min-h-0 gap-2.5 lg:grid-cols-[236px_minmax(0,1fr)_298px]">
        <Panel
          dataTour="routes"
          title="Shared vehicles"
          sub={`${latest?.companiesServed ?? 0} companies pooled`}
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
                  {/* The point of the product: whose goods share this van */}
                  {(r.companies ?? []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5 pl-[22px]">
                      {(r.companies ?? []).map((c) => (
                        <span
                          key={c}
                          className="rounded px-1 py-0.5 text-[8.5px] font-semibold"
                          style={{
                            background: `color-mix(in srgb, ${color} 16%, var(--kf-mix))`,
                            color,
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </Panel>

        <div
          data-tour="map"
          className="kf-card min-h-[300px] overflow-hidden p-1.5"
        >
          <RouteMap
            shipments={shipments ?? []}
            routes={mapRoutes}
            vehicles={vehicles ?? []}
            consolidated={consolidated && done}
            visible={visible}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        <FleetStatus
          dataTour="fleet"
          vehicles={vehicles ?? []}
          busy={busy}
          onDispatch={() => act(() => dispatchFleet({}))}
          onReset={() => act(() => resetFleet({}))}
        />
      </div>

      {/* Reasoning, disruption, live state */}
      <div className="grid min-h-0 gap-2.5 lg:grid-cols-[minmax(0,1.2fr)_260px_minmax(0,1fr)]">
        <WhyPanel
          dataTour="why"
          strategy={latest?.strategy}
          routeLabel={selectedRoute?.label}
          routeZone={selectedRoute?.zone}
          rationale={selectedRoute?.rationale}
          companies={selectedRoute?.companies}
        />
        <DisruptionPanel
          dataTour="disruption"
          scenarios={scenarios ?? []}
          busy={busy}
          activeDisruption={latest?.disruption}
          onTrigger={(id) => act(() => disrupt({ scenarioId: id }))}
        />
        <LiveState dataTour="live" events={events ?? []} />
      </div>

      <Tour />
    </div>
  );
}

function Mini({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="kf-card flex flex-col justify-center px-3 py-2.5">
      <div className="text-[10px] font-semibold text-[var(--kf-ink-2)]">
        {label}
      </div>
      <div
        className="mt-1 text-[19px] font-semibold leading-none tabular-nums"
        style={{ color: color ?? "var(--kf-ink)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[9px] text-[var(--kf-ink-3)]">{sub}</div>
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
