"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  Gauge,
  Globe,
  Home,
  Layers,
  Leaf,
  Loader2,
  Map as MapIcon,
  Radio,
  Route as RouteIcon,
  Search,
  Settings,
  Terminal,
  Truck,
  Users,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LoadShareMark } from "@/components/Brand";
import { BucketBars, SegmentGauge } from "@/components/charts";
import { FleetStatus, type Vehicle } from "@/components/Fleet";
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

type Summary = {
  runsCompleted: number;
  suppliersMapped: number;
  suppliersTotal: number;
  consignments: number;
  baselineVans: number;
  usedVans: number;
  vansSaved: number;
  baselineKm: number;
  consolidatedKm: number;
  kmSaved: number;
  kmSavedPct: number;
  co2SavedKg: number;
  costSavedAed: number;
  costRateAed: number;
  avgUtilisation: number;
  utilisationBuckets: { label: string; count: number }[];
  stopsPerRoute: number;
  feasiblePct: number;
  recent: {
    id: string;
    name: string;
    createdAt: number;
    routeCount: number;
    shipmentCount: number;
    consolidatedKm: number;
    kmSaved: number;
    co2Saved: number;
    utilisation: number;
    feasible: boolean;
  }[];
};

type RunDoc = {
  _id: string;
  status: string;
  devinSessionUrl?: string;
  devinStatusDetail?: string;
  feasible?: boolean;
  proofOutput?: string;
};

type ShipmentDoc = {
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

type RouteDoc = {
  _id: string;
  label: string;
  zone: string;
  stopCount: number;
  loadKg: number;
  distanceKm: number;
  windowStart?: string;
  windowEnd?: string;
  shipmentRefs: string[];
};

type SupplierDoc = {
  _id: string;
  name: string;
  status: string;
  address?: string;
  receivingFrom?: string;
  receivingTo?: string;
  lat?: number;
};

type TraceEvent = {
  _id: string;
  provider: string;
  message: string;
  timestamp: number;
};

type Tab = "proof" | "activity" | "suppliers";

export default function Console() {
  const seed = useMutation(api.suppliers.seedDemoSuppliers);
  const createRun = useMutation(api.runs.create);
  const dispatchFleet = useMutation(api.fleet.dispatch);
  const resetFleet = useMutation(api.fleet.reset);

  const stats = useQuery(api.stats.summary, {}) as Summary | undefined;
  const latest = useQuery(api.runs.latest, {}) as RunDoc | null | undefined;
  const runId = latest?._id as Id<"runs"> | undefined;

  const suppliers = useQuery(api.suppliers.list, {}) as SupplierDoc[] | undefined;
  const shipments = useQuery(api.runs.shipments, runId ? { runId } : "skip") as
    | ShipmentDoc[]
    | undefined;
  const routes = useQuery(api.runs.routes, runId ? { runId } : "skip") as
    | RouteDoc[]
    | undefined;
  const events = useQuery(
    api.events.byRun,
    runId ? { runId, limit: 40 } : "skip",
  ) as TraceEvent[] | undefined;
  const vehicles = useQuery(api.fleet.list, {}) as Vehicle[] | undefined;

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consolidated, setConsolidated] = useState(true);
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("proof");

  const done = latest?.status === "completed";
  const mappable = (suppliers ?? []).filter(
    (s) => s.status === "enriched" && s.lat != null,
  );

  const visible = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const r of routes ?? []) m[r.label] = !hidden.includes(r.label);
    return m;
  }, [routes, hidden]);

  const mapRoutes = useMemo(
    () =>
      (routes ?? []).map((r) => ({
        label: r.label,
        zone: r.zone,
        shipmentRefs: r.shipmentRefs,
        distanceKm: r.distanceKm,
        loadKg: r.loadKg,
      })),
    [routes],
  );

  async function act(fn: () => Promise<unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      if (key === "run") {
        setSelected(null);
        setHidden([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col lg:h-[100dvh] lg:overflow-hidden">
      {/* Top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--kf-accent)]">
            <LoadShareMark size={16} color="#fff" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--kf-ink)]">
            LoadShare
          </span>
          <span className="ml-1 hidden text-[11px] text-[var(--kf-ink-3)] sm:inline">
            Dubai last-mile consolidation
          </span>
        </div>

        <div className="hidden flex-1 justify-center xl:flex">
          <div className="flex w-full max-w-sm items-center gap-2 rounded-full bg-[var(--kf-card)] px-3.5 py-2 ring-1 ring-[var(--kf-border)]">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--kf-ink-3)]" />
            <input
              placeholder="Search routes, suppliers, zones..."
              className="w-full bg-transparent text-[12.5px] text-[var(--kf-ink)] outline-none placeholder:text-[var(--kf-ink-3)]"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11px] text-[var(--kf-ink-3)] sm:inline">
            {stats?.suppliersMapped ?? 0}/{stats?.suppliersTotal ?? 0} suppliers ·{" "}
            <StatusText
              status={latest?.status}
              detail={latest?.devinStatusDetail}
            />
          </span>
          <button
            onClick={() => act(() => seed({}), "seed")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--kf-card)] px-3 py-2 text-[11.5px] font-semibold text-[var(--kf-ink-2)] ring-1 ring-[var(--kf-border)] transition hover:text-[var(--kf-ink)] disabled:opacity-50"
          >
            {busy === "seed" ? (
              <Loader2 className="h-3.5 w-3.5 kf-spin" />
            ) : (
              <Globe className="h-3.5 w-3.5" />
            )}
            Suppliers
          </button>
          <button
            onClick={() =>
              act(
                () => createRun({ name: "Dubai last-mile consolidation" }),
                "run",
              )
            }
            disabled={busy !== null || mappable.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11.5px] font-semibold text-white transition disabled:opacity-50"
            style={{ background: "var(--kf-accent)" }}
          >
            {busy === "run" ? (
              <Loader2 className="h-3.5 w-3.5 kf-spin" />
            ) : (
              <Truck className="h-3.5 w-3.5" />
            )}
            Run consolidation
          </button>
        </div>
      </header>

      {error && (
        <p className="shrink-0 px-4 pb-1 text-[12px] text-[var(--kf-fail)]">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1 gap-2.5 px-2.5 pb-2.5 sm:px-3.5 sm:pb-3.5">
        {/* Rail */}
        <nav className="hidden shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-[var(--kf-card)] p-1.5 ring-1 ring-[var(--kf-border)] lg:flex">
          <RailIcon active>
            <Home className="h-4 w-4" />
          </RailIcon>
          <RailIcon>
            <MapIcon className="h-4 w-4" />
          </RailIcon>
          <RailIcon>
            <RouteIcon className="h-4 w-4" />
          </RailIcon>
          <RailIcon>
            <Layers className="h-4 w-4" />
          </RailIcon>
          <RailIcon>
            <Users className="h-4 w-4" />
          </RailIcon>
          <RailIcon>
            <Settings className="h-4 w-4" />
          </RailIcon>
        </nav>

        {/* Console grid: KPI strip, main row, bottom row. Page never scrolls. */}
        <div className="grid min-h-0 flex-1 gap-2.5 lg:grid-rows-[auto_minmax(0,1fr)_minmax(0,215px)]">
          {/* KPI strip */}
          <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi
              accent
              label="Consolidations"
              value={stats?.runsCompleted ?? 0}
              sub="proven plans"
            />
            <Kpi
              label="Consignments"
              value={stats?.consignments ?? 0}
              sub="moved"
              icon={<Boxes className="h-3.5 w-3.5" />}
            />
            <Kpi
              label="Vans"
              value={`${stats?.baselineVans ?? 0}→${stats?.usedVans ?? 0}`}
              sub={`${stats?.vansSaved ?? 0} removed`}
              icon={<Truck className="h-3.5 w-3.5" />}
              valueColor="var(--kf-accent)"
            />
            <Kpi
              label="Distance cut"
              value={`${stats?.kmSavedPct ?? 0}%`}
              sub={`${stats?.kmSaved ?? 0} km`}
              icon={<RouteIcon className="h-3.5 w-3.5" />}
            />
            <Kpi
              label="CO2 reduced"
              value={`${stats?.co2SavedKg ?? 0} kg`}
              sub="avoided"
              icon={<Leaf className="h-3.5 w-3.5" />}
              valueColor="var(--kf-pass)"
            />
            <Kpi
              label="Cost avoided"
              value={`AED ${(stats?.costSavedAed ?? 0).toLocaleString()}`}
              sub={`est. AED ${stats?.costRateAed ?? 0}/km`}
              icon={<Gauge className="h-3.5 w-3.5" />}
            />
          </div>

          {/* Main row */}
          <div className="grid min-h-0 gap-2.5 lg:grid-cols-[236px_minmax(0,1fr)_310px]">
            {/* Routes */}
            <div className="kf-card flex min-h-0 flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 pb-2 pt-3">
                <div>
                  <h2 className="text-[12.5px] font-semibold tracking-tight text-[var(--kf-ink)]">
                    Routes
                  </h2>
                  <p className="text-[10px] text-[var(--kf-ink-3)]">
                    {selected ? "Isolated" : "Click to isolate"}
                  </p>
                </div>
                <div className="flex rounded-full bg-[var(--kf-card-sub)] p-0.5">
                  <Toggle
                    active={!consolidated}
                    onClick={() => setConsolidated(false)}
                  >
                    Before
                  </Toggle>
                  <Toggle
                    active={consolidated}
                    onClick={() => setConsolidated(true)}
                  >
                    After
                  </Toggle>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
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
                            onChange={() =>
                              setHidden((h) =>
                                on
                                  ? [...h, r.label]
                                  : h.filter((x) => x !== r.label),
                              )
                            }
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
                          <span
                            className="shrink-0 font-mono text-[9px]"
                            style={{ color }}
                          >
                            {r.windowStart}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Map */}
            <div className="kf-card min-h-[320px] overflow-hidden p-1.5">
              <RouteMap
                shipments={shipments ?? []}
                routes={mapRoutes}
                consolidated={consolidated && done}
                visible={visible}
                selected={selected}
                onSelect={setSelected}
              />
            </div>

            {/* Fleet */}
            <FleetStatus
              vehicles={vehicles ?? []}
              busy={busy !== null}
              onDispatch={() => act(() => dispatchFleet({}), "dispatch")}
              onReset={() => act(() => resetFleet({}), "reset")}
            />
          </div>

          {/* Bottom row */}
          <div className="grid min-h-0 gap-2.5 lg:grid-cols-[300px_minmax(0,1fr)_330px]">
            {/* Utilisation */}
            <div className="kf-card flex min-h-0 overflow-hidden px-3 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="text-[12px] font-semibold tracking-tight text-[var(--kf-ink)]">
                  Utilisation
                </h2>
                <div className="flex min-h-0 flex-1 items-center gap-1">
                  <div className="shrink-0">
                    <SegmentGauge
                      pct={stats?.avgUtilisation ?? 0}
                      size={124}
                      segments={10}
                    />
                  </div>
                  <div className="min-h-0 min-w-0 flex-1">
                    <BucketBars
                      buckets={stats?.utilisationBuckets ?? []}
                      height={104}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent runs */}
            <div className="kf-card flex min-h-0 flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 pb-1.5 pt-2.5">
                <h2 className="text-[12px] font-semibold tracking-tight text-[var(--kf-ink)]">
                  Recent consolidations
                </h2>
                <span className="text-[10px] text-[var(--kf-ink-3)]">
                  {stats?.recent.length ?? 0} runs
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
                <table className="w-full min-w-[560px] border-collapse">
                  <thead className="sticky top-0 bg-[var(--kf-card)]">
                    <tr className="text-left text-[9.5px] uppercase tracking-[0.06em] text-[var(--kf-ink-3)]">
                      <Th>Run</Th>
                      <Th>Vans</Th>
                      <Th>Loads</Th>
                      <Th>Distance</Th>
                      <Th>Saved</Th>
                      <Th>CO2</Th>
                      <Th>Util</Th>
                      <Th>When</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.recent ?? []).map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-[var(--kf-border)] text-[11.5px] text-[var(--kf-ink)]"
                      >
                        <Td>
                          <span className="flex items-center gap-1.5">
                            {r.feasible && (
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ background: "var(--kf-pass)" }}
                              />
                            )}
                            <span className="truncate">{r.name}</span>
                          </span>
                        </Td>
                        <Td>{r.routeCount}</Td>
                        <Td>{r.shipmentCount}</Td>
                        <Td>{r.consolidatedKm} km</Td>
                        <Td>
                          <span style={{ color: "var(--kf-pass)" }}>
                            {r.kmSaved} km
                          </span>
                        </Td>
                        <Td>{r.co2Saved} kg</Td>
                        <Td>{r.utilisation}%</Td>
                        <Td>
                          <span className="text-[10.5px] text-[var(--kf-ink-3)]">
                            {new Date(r.createdAt).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(stats?.recent ?? []).length === 0 && (
                  <p className="px-2 py-4 text-center text-[11.5px] text-[var(--kf-ink-3)]">
                    No completed consolidations yet.
                  </p>
                )}
              </div>
            </div>

            {/* Tabbed detail */}
            <div className="kf-card flex min-h-0 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center gap-1 px-2 pt-2">
                <TabBtn active={tab === "proof"} onClick={() => setTab("proof")}>
                  <Terminal className="h-3 w-3" />
                  Proof
                </TabBtn>
                <TabBtn
                  active={tab === "activity"}
                  onClick={() => setTab("activity")}
                >
                  <Activity className="h-3 w-3" />
                  Activity
                </TabBtn>
                <TabBtn
                  active={tab === "suppliers"}
                  onClick={() => setTab("suppliers")}
                >
                  <Globe className="h-3 w-3" />
                  Suppliers
                </TabBtn>
                {tab === "proof" && latest?.feasible !== undefined && (
                  <span
                    className="ml-auto mr-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{
                      background: `color-mix(in srgb, ${latest.feasible ? "var(--kf-pass)" : "var(--kf-fail)"} 16%, var(--kf-mix))`,
                      color: latest.feasible
                        ? "var(--kf-pass)"
                        : "var(--kf-fail)",
                    }}
                  >
                    {latest.feasible ? "Feasible" : "Infeasible"}
                  </span>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-2">
                {tab === "proof" &&
                  (latest?.proofOutput ? (
                    <pre className="whitespace-pre rounded-lg bg-[var(--kf-terminal)] p-2.5 font-mono text-[9.5px] leading-relaxed text-[var(--kf-ink-2)] ring-1 ring-[var(--kf-border)]">
                      {latest.proofOutput}
                    </pre>
                  ) : (
                    <p className="p-2 text-[11.5px] text-[var(--kf-ink-3)]">
                      No proof yet.
                    </p>
                  ))}

                {tab === "activity" && (
                  <ol>
                    {(events ?? []).map((e) => (
                      <li key={e._id} className="flex gap-2 py-1">
                        <span className="w-[44px] shrink-0 font-mono text-[9px] tabular-nums text-[var(--kf-ink-3)]">
                          {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                            hour12: false,
                          })}
                        </span>
                        <ProviderLabel provider={e.provider} />
                        <span className="min-w-0 flex-1 text-[10.5px] leading-snug text-[var(--kf-ink-2)]">
                          {e.message}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}

                {tab === "suppliers" && (
                  <div className="space-y-1.5">
                    {(suppliers ?? []).map((s) => {
                      const usable = s.status === "enriched" && s.lat != null;
                      return (
                        <div
                          key={s._id}
                          className="rounded-lg bg-[var(--kf-card-sub)] px-2.5 py-2"
                          style={{ opacity: usable ? 1 : 0.5 }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[11.5px] font-semibold text-[var(--kf-ink)]">
                              {s.name}
                            </span>
                            <span
                              className="shrink-0 font-mono text-[9.5px] font-semibold"
                              style={{
                                color: usable
                                  ? "var(--kf-pass)"
                                  : "var(--kf-ink-3)",
                              }}
                            >
                              {usable
                                ? `${s.receivingFrom ?? "--"}-${s.receivingTo ?? "--"}`
                                : "no address"}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-[var(--kf-ink-2)]">
                            {s.address ?? "Not published on site"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-[var(--kf-border)] px-2.5 py-1.5">
                <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-[var(--kf-ink-3)]">
                  <Radio className="h-2.5 w-2.5" style={{ color: "var(--kf-pass)" }} />
                  Live · addresses and hours read from supplier sites, consignments
                  synthetic
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function RailIcon({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={`grid h-9 w-9 place-items-center rounded-xl transition ${
        active
          ? "bg-[var(--kf-solid)] text-[var(--kf-solid-fg)]"
          : "text-[var(--kf-ink-3)] hover:bg-[var(--kf-card-sub)]"
      }`}
    >
      {children}
    </span>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  accent,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  valueColor?: string;
}) {
  if (accent) {
    return (
      <div
        className="rounded-2xl px-3.5 py-2.5 text-white shadow-[var(--kf-shadow)]"
        style={{
          background: "linear-gradient(140deg, #ff9a5c 0%, var(--kf-accent) 100%)",
        }}
      >
        <div className="text-[11px] font-semibold opacity-90">{label}</div>
        <div className="mt-1.5 text-[24px] font-semibold leading-none tabular-nums">
          {value}
        </div>
        {sub && <div className="mt-1 text-[9.5px] opacity-75">{sub}</div>}
      </div>
    );
  }
  return (
    <div className="kf-card px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[var(--kf-ink-2)]">
          {label}
        </span>
        {icon && <span className="text-[var(--kf-ink-3)]">{icon}</span>}
      </div>
      <div
        className="mt-1.5 text-[22px] font-semibold leading-none tabular-nums"
        style={{ color: valueColor ?? "var(--kf-ink)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[9.5px] text-[var(--kf-ink-3)]">{sub}</div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-1.5 pb-1.5 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-1.5 py-1.5 tabular-nums">{children}</td>;
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

function TabBtn({
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
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10.5px] font-semibold transition ${
        active
          ? "bg-[var(--kf-card-sub)] text-[var(--kf-ink)]"
          : "text-[var(--kf-ink-3)] hover:text-[var(--kf-ink-2)]"
      }`}
    >
      {children}
    </button>
  );
}

function StatusText({ status, detail }: { status?: string; detail?: string }) {
  if (status === "completed")
    return <span style={{ color: "var(--kf-pass)" }}>plan ready</span>;
  if (status === "failed" || status === "timeout")
    return <span style={{ color: "var(--kf-fail)" }}>failed</span>;
  if (!status) return <span>no run</span>;
  return (
    <span style={{ color: "var(--kf-running)" }}>
      optimising{detail ? ` (${detail.replace(/_/g, " ")})` : "…"}
    </span>
  );
}

function ProviderLabel({ provider }: { provider: string }) {
  const map: Record<string, { label: string; color: string }> = {
    "context.dev": { label: "CONTEXT", color: "#4d9dff" },
    convex: { label: "CONVEX", color: "#ffb340" },
    devin: { label: "DEVIN", color: "#b39dff" },
    loadshare: { label: "FLEET", color: "var(--kf-accent)" },
  };
  const s = map[provider] ?? {
    label: provider.toUpperCase(),
    color: "var(--kf-ink-3)",
  };
  return (
    <span
      className="w-[54px] shrink-0 font-mono text-[8.5px] font-semibold tracking-[0.06em]"
      style={{ color: s.color }}
    >
      {s.label}
    </span>
  );
}
