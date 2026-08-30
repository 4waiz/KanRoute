"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Boxes,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Gauge,
  Globe,
  HelpCircle,
  Home,
  Layers,
  Leaf,
  Loader2,
  Map as MapIcon,
  Radio,
  Search,
  Settings,
  Terminal,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LoadShareMark } from "@/components/Brand";
import { BucketBars, MetricBar, SegmentGauge, UtilBar } from "@/components/charts";
import { FleetStatus, type Vehicle } from "@/components/Fleet";
import { ROUTE_COLORS } from "@/lib/routeColors";

// Leaflet touches window on import, so it must not render on the server.
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
    baselineKm: number;
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

export default function Dashboard() {
  const seed = useMutation(api.suppliers.seedDemoSuppliers);
  const createRun = useMutation(api.runs.create);

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
    runId ? { runId, limit: 30 } : "skip",
  ) as TraceEvent[] | undefined;
  const vehicles = useQuery(api.fleet.list, {}) as Vehicle[] | undefined;

  const dispatchFleet = useMutation(api.fleet.dispatch);
  const resetFleet = useMutation(api.fleet.reset);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consolidated, setConsolidated] = useState(true);
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showProof, setShowProof] = useState(false);

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

  async function loadSuppliers() {
    setBusy("seed");
    setError(null);
    try {
      await seed({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suppliers.");
    } finally {
      setBusy(null);
    }
  }

  async function runFleet(fn: () => Promise<unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fleet action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function startRun() {
    setBusy("run");
    setError(null);
    try {
      await createRun({ name: "Dubai last-mile consolidation" });
      setSelected(null);
      setHidden([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start run.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-[500] flex flex-wrap items-center gap-4 bg-[var(--kf-shell)]/92 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--kf-accent)]">
            <LoadShareMark size={18} color="#fff" />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-[var(--kf-ink)]">
            LoadShare
          </span>
        </div>

        <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-full bg-[var(--kf-card)] px-4 py-2.5 shadow-[var(--kf-shadow-sm)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--kf-ink-3)]" />
            <input
              placeholder="Search consolidations, suppliers, zones..."
              className="w-full bg-transparent text-[13px] text-[var(--kf-ink)] outline-none placeholder:text-[var(--kf-ink-3)]"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="kf-chip grid h-9 w-9 place-items-center text-[var(--kf-ink-2)]">
            <HelpCircle className="h-4 w-4" />
          </span>
          <span className="kf-chip flex items-center gap-2 px-3 py-1.5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--kf-accent)] text-[10px] font-bold text-white">
              LS
            </span>
            <span className="hidden text-[12.5px] font-medium text-[var(--kf-ink)] sm:inline">
              Fleet ops
            </span>
          </span>
        </div>
      </div>

      <div className="flex gap-4 px-3 pb-8 sm:px-5">
        {/* Icon rail */}
        <nav className="sticky top-[76px] hidden h-fit shrink-0 flex-col items-center gap-2 rounded-3xl bg-[var(--kf-card)] p-2 shadow-[var(--kf-shadow)] lg:flex">
          <RailIcon active>
            <Home className="h-4 w-4" />
          </RailIcon>
          <RailIcon>
            <CalendarDays className="h-4 w-4" />
          </RailIcon>
          <RailIcon>
            <Layers className="h-4 w-4" />
          </RailIcon>
          <RailIcon>
            <MapIcon className="h-4 w-4" />
          </RailIcon>
          <RailIcon>
            <Users className="h-4 w-4" />
          </RailIcon>
          <RailIcon>
            <Settings className="h-4 w-4" />
          </RailIcon>
        </nav>

        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[30px] font-semibold leading-none tracking-tight text-[var(--kf-ink)] sm:text-[36px]">
                Dashboard
              </h1>
              <p className="mt-2 text-[12.5px] text-[var(--kf-ink-2)]">
                {stats?.suppliersMapped ?? 0} of {stats?.suppliersTotal ?? 0}{" "}
                suppliers mapped from live websites ·{" "}
                <StatusText
                  status={latest?.status}
                  detail={latest?.devinStatusDetail}
                />
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={loadSuppliers}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--kf-card)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--kf-ink-2)] shadow-[var(--kf-shadow-sm)] transition hover:text-[var(--kf-ink)] disabled:opacity-50"
              >
                {busy === "seed" ? (
                  <Loader2 className="h-3.5 w-3.5 kf-spin" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                Refresh suppliers
              </button>
              <button
                onClick={startRun}
                disabled={busy !== null || mappable.length === 0}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12.5px] font-semibold text-white transition disabled:opacity-50"
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
          </div>

          {error && (
            <p className="mb-3 text-[13px] text-[var(--kf-fail)]">{error}</p>
          )}

          {/* KPI grid */}
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-[22px] p-5 text-white shadow-[var(--kf-shadow)]"
                style={{
                  background:
                    "linear-gradient(150deg, #ff8a4c 0%, var(--kf-accent) 100%)",
                }}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[12.5px] font-semibold">
                    Consolidations run
                  </span>
                  <Zap className="h-4 w-4 opacity-80" />
                </div>
                <div className="mt-7 text-[38px] font-semibold leading-none tabular-nums">
                  {stats?.runsCompleted ?? 0}
                </div>
              </div>

              <KpiCard
                label="Consignments moved"
                value={stats?.consignments ?? 0}
                icon={<Boxes className="h-4 w-4" />}
              />
              <KpiCard
                label="Cost avoided"
                value={`AED ${(stats?.costSavedAed ?? 0).toLocaleString()}`}
                sub={`est. at AED ${stats?.costRateAed ?? 0}/km`}
                icon={<Gauge className="h-4 w-4" />}
              />
              <KpiCard
                label="CO2 reduced"
                value={`${stats?.co2SavedKg ?? 0} kg`}
                sub={`${stats?.kmSaved ?? 0} km not driven`}
                icon={<Leaf className="h-4 w-4" />}
                accent="var(--kf-pass)"
              />
            </div>

            <div className="kf-card p-5">
              <div className="flex items-start justify-between">
                <h2 className="text-[14px] font-semibold tracking-tight text-[var(--kf-ink)]">
                  Average vehicle utilisation
                </h2>
                <Zap className="h-4 w-4 text-[var(--kf-ink-3)]" />
              </div>
              <div className="mt-1 flex justify-center">
                <SegmentGauge pct={stats?.avgUtilisation ?? 0} size={200} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <SubStat
                  label="Vans removed"
                  value={`${stats?.vansSaved ?? 0}`}
                  icon={<Truck className="h-3.5 w-3.5" />}
                />
                <SubStat
                  label="Proven feasible"
                  value={`${stats?.feasiblePct ?? 0}%`}
                  icon={<Gauge className="h-3.5 w-3.5" />}
                />
              </div>
            </div>

            <div className="kf-card p-5">
              <div className="flex items-start justify-between">
                <h2 className="text-[14px] font-semibold tracking-tight text-[var(--kf-ink)]">
                  Utilisation distribution
                </h2>
                <Layers className="h-4 w-4 text-[var(--kf-ink-3)]" />
              </div>
              <p className="mt-0.5 text-[11.5px] text-[var(--kf-ink-3)]">
                Routes by how full the vehicle is
              </p>
              <div className="mt-3">
                <BucketBars buckets={stats?.utilisationBuckets ?? []} />
              </div>
            </div>
          </div>

          {/* Map + route list */}
          <div className="mt-3 grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="kf-card flex max-h-[560px] flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 pb-2.5 pt-4">
                <div>
                  <h2 className="text-[14px] font-semibold tracking-tight text-[var(--kf-ink)]">
                    Latest routes
                  </h2>
                  <p className="mt-0.5 text-[11.5px] text-[var(--kf-ink-3)]">
                    {selected ? "Isolated" : "Click to isolate"}
                  </p>
                </div>
                <div className="flex rounded-full bg-[var(--kf-card-sub)] p-1">
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

              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {(routes ?? []).length === 0 ? (
                  <div className="px-3 py-10 text-center">
                    <div className="relative mx-auto h-2 w-36 overflow-hidden rounded-full bg-[var(--kf-card-sub)] kf-sweep" />
                    <p className="mt-4 text-[12px] text-[var(--kf-ink-3)]">
                      Devin is writing and running the optimiser
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
                        className="kf-enter mb-1.5 cursor-pointer rounded-xl px-2.5 py-2.5 transition hover:bg-[var(--kf-card-sub)]"
                        style={
                          isSel
                            ? {
                                background: "var(--kf-card-sub)",
                                boxShadow: `inset 0 0 0 2px ${color}`,
                              }
                            : {}
                        }
                      >
                        <div className="flex items-center gap-2.5">
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
                            className="h-4 w-4 shrink-0 accent-[var(--kf-accent)]"
                          />
                          <span
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold text-white"
                            style={{ background: color, opacity: on ? 1 : 0.35 }}
                          >
                            {r.label.replace(/[^0-9]/g, "") || r.label}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-semibold text-[var(--kf-ink)]">
                              {r.zone}
                            </span>
                            <span className="block font-mono text-[10px] text-[var(--kf-ink-3)]">
                              {r.stopCount} stops · {r.loadKg} kg · {r.distanceKm} km
                            </span>
                          </span>
                        </div>
                        <div className="mt-1.5 pl-[26px]">
                          <span
                            className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                            style={{
                              background: `color-mix(in srgb, ${color} 14%, white)`,
                              color,
                            }}
                          >
                            {r.windowStart}-{r.windowEnd}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="kf-card overflow-hidden p-2">
              <div className="h-[420px] w-full sm:h-[560px]">
                <RouteMap
                  shipments={shipments ?? []}
                  routes={mapRoutes}
                  consolidated={consolidated && done}
                  visible={visible}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>
            </div>
          </div>

          {/* Fleet */}
          <div className="mt-3">
            <FleetStatus
              vehicles={vehicles ?? []}
              busy={busy !== null}
              onDispatch={() => runFleet(() => dispatchFleet({}), "dispatch")}
              onReset={() => runFleet(() => resetFleet({}), "reset")}
            />
          </div>

          {/* Table + efficiency */}
          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="kf-card overflow-hidden">
              <div className="flex items-center justify-between px-5 pb-3 pt-4">
                <h2 className="text-[15px] font-semibold tracking-tight text-[var(--kf-ink)]">
                  Recent consolidations
                </h2>
                <span className="text-[11.5px] text-[var(--kf-ink-3)]">
                  {stats?.recent.length ?? 0} runs
                </span>
              </div>
              <div className="overflow-x-auto px-3 pb-4">
                <table className="w-full min-w-[700px] border-collapse">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-[var(--kf-ink-3)]">
                      <Th>Run</Th>
                      <Th>Vans</Th>
                      <Th>Loads</Th>
                      <Th>Distance</Th>
                      <Th>Saved</Th>
                      <Th>CO2</Th>
                      <Th>Utilisation</Th>
                      <Th>When</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats?.recent ?? []).map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-[var(--kf-border)] text-[12.5px] text-[var(--kf-ink)]"
                      >
                        <Td>
                          <span className="flex items-center gap-2 font-medium">
                            {r.feasible && (
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ background: "var(--kf-pass)" }}
                              />
                            )}
                            {r.name}
                          </span>
                        </Td>
                        <Td>
                          <span className="tabular-nums">{r.routeCount}</span>
                        </Td>
                        <Td>
                          <span className="tabular-nums">{r.shipmentCount}</span>
                        </Td>
                        <Td>
                          <span className="tabular-nums">
                            {r.consolidatedKm} km
                          </span>
                        </Td>
                        <Td>
                          <span
                            className="font-semibold tabular-nums"
                            style={{ color: "var(--kf-pass)" }}
                          >
                            {r.kmSaved} km
                          </span>
                        </Td>
                        <Td>
                          <span className="tabular-nums">{r.co2Saved} kg</span>
                        </Td>
                        <Td>
                          <UtilBar pct={r.utilisation} />
                        </Td>
                        <Td>
                          <span className="text-[11.5px] text-[var(--kf-ink-3)]">
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
                  <p className="px-2 py-6 text-center text-[12.5px] text-[var(--kf-ink-3)]">
                    No completed consolidations yet.
                  </p>
                )}
              </div>
            </div>

            <div className="kf-card p-5">
              <div className="flex items-start justify-between">
                <h2 className="text-[15px] font-semibold tracking-tight text-[var(--kf-ink)]">
                  Efficiency metrics
                </h2>
                <Zap className="h-4 w-4 text-[var(--kf-ink-3)]" />
              </div>
              <div className="mt-2">
                <MetricBar
                  label="Average stops per route"
                  value={`${stats?.stopsPerRoute ?? 0}`}
                  pct={((stats?.stopsPerRoute ?? 0) / 5) * 100}
                />
                <MetricBar
                  label="Distance reduction"
                  value={`${stats?.kmSavedPct ?? 0}%`}
                  pct={stats?.kmSavedPct ?? 0}
                  color="var(--kf-pass)"
                />
                <MetricBar
                  label="Average vehicle utilisation"
                  value={`${stats?.avgUtilisation ?? 0}%`}
                  pct={stats?.avgUtilisation ?? 0}
                />
                <MetricBar
                  label="Plans proven feasible"
                  value={`${stats?.feasiblePct ?? 0}%`}
                  pct={stats?.feasiblePct ?? 0}
                  color="var(--kf-pass)"
                />
                <MetricBar
                  label="Fleet size reduction"
                  value={`${stats?.baselineVans ?? 0} to ${stats?.usedVans ?? 0}`}
                  pct={
                    stats?.baselineVans
                      ? ((stats.baselineVans - stats.usedVans) /
                          stats.baselineVans) *
                        100
                      : 0
                  }
                />
              </div>
            </div>
          </div>

          {/* Proof + suppliers */}
          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="kf-card overflow-hidden">
              <button
                onClick={() => setShowProof((s) => !s)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <div>
                  <h2 className="text-[14px] font-semibold tracking-tight text-[var(--kf-ink)]">
                    Feasibility proof
                  </h2>
                  <p className="mt-0.5 text-[11.5px] text-[var(--kf-ink-3)]">
                    Verbatim stdout from the constraint checker Devin executed
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  {latest?.feasible !== undefined && (
                    <span
                      className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background: latest.feasible
                          ? "color-mix(in srgb, var(--kf-pass) 14%, white)"
                          : "color-mix(in srgb, var(--kf-fail) 14%, white)",
                        color: latest.feasible
                          ? "var(--kf-pass)"
                          : "var(--kf-fail)",
                      }}
                    >
                      {latest.feasible ? "Feasible" : "Infeasible"}
                    </span>
                  )}
                  <ChevronDown
                    className={`h-4 w-4 text-[var(--kf-ink-3)] transition ${showProof ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
              {showProof && latest?.proofOutput && (
                <div className="px-5 pb-5">
                  <div className="overflow-hidden rounded-2xl bg-[var(--kf-ink)]">
                    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
                      <Terminal className="h-3.5 w-3.5 text-white/45" />
                      <span className="font-mono text-[10px] tracking-wider text-white/60">
                        python checker.py
                      </span>
                    </div>
                    <pre className="max-h-72 overflow-auto px-4 py-3.5 font-mono text-[11px] leading-relaxed text-white/80">
                      {latest.proofOutput}
                    </pre>
                  </div>
                  {latest.devinSessionUrl && (
                    <a
                      href={latest.devinSessionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--kf-running)] hover:underline"
                    >
                      Open the Devin session
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="kf-card flex max-h-[360px] flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 pb-2.5 pt-4">
                <h2 className="text-[14px] font-semibold tracking-tight text-[var(--kf-ink)]">
                  Supplier data
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--kf-card-sub)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#2b8fd6]">
                  <Globe className="h-3 w-3" />
                  Context.dev
                </span>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-5">
                {(suppliers ?? []).map((s) => {
                  const usable = s.status === "enriched" && s.lat != null;
                  return (
                    <div
                      key={s._id}
                      className="rounded-xl bg-[var(--kf-card-sub)] px-3 py-2.5"
                      style={{ opacity: usable ? 1 : 0.5 }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-[var(--kf-ink)]">
                          {s.name}
                        </span>
                        <span
                          className="shrink-0 font-mono text-[10.5px] font-semibold"
                          style={{
                            color: usable ? "var(--kf-pass)" : "var(--kf-ink-3)",
                          }}
                        >
                          {usable
                            ? `${s.receivingFrom ?? "--"}-${s.receivingTo ?? "--"}`
                            : "not mappable"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-[var(--kf-ink-2)]">
                        {s.address ?? "No address published on site"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="kf-card mt-3 overflow-hidden">
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <h2 className="text-[14px] font-semibold tracking-tight text-[var(--kf-ink)]">
                Activity
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--kf-card-sub)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--kf-ink-2)]">
                <Radio className="h-3 w-3" style={{ color: "var(--kf-pass)" }} />
                Live
              </span>
            </div>
            <div className="max-h-[190px] overflow-y-auto px-5 pb-4">
              <ol>
                {(events ?? []).map((e) => (
                  <li key={e._id} className="kf-enter flex gap-3 py-1.5">
                    <span className="w-[52px] shrink-0 font-mono text-[10px] tabular-nums text-[var(--kf-ink-3)]">
                      {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                        hour12: false,
                      })}
                    </span>
                    <ProviderLabel provider={e.provider} />
                    <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-[var(--kf-ink-2)]">
                      {e.message}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <p className="mt-4 text-[10.5px] leading-relaxed text-[var(--kf-ink-3)]">
            Supplier addresses and receiving hours are read live from each
            company&apos;s public website. Consignment volumes and destinations
            are synthetic test data. Area coordinates are district level. Cost
            avoided is an estimate at AED {stats?.costRateAed ?? 0}/km. No
            affiliation with the named businesses is implied.
          </p>
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
      className={`grid h-10 w-10 place-items-center rounded-2xl transition ${
        active
          ? "bg-[var(--kf-ink)] text-white"
          : "text-[var(--kf-ink-3)] hover:bg-[var(--kf-card-sub)]"
      }`}
    >
      {children}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="kf-card flex flex-col justify-between p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-[var(--kf-ink-2)]">
          {label}
        </span>
        {icon && (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--kf-card-sub)] text-[var(--kf-ink-2)]">
            {icon}
          </span>
        )}
      </div>
      <div>
        <div
          className="mt-6 text-[24px] font-semibold leading-none tracking-tight tabular-nums"
          style={{ color: accent ?? "var(--kf-ink)" }}
        >
          {value}
        </div>
        {sub && (
          <div className="mt-1.5 text-[10.5px] text-[var(--kf-ink-3)]">{sub}</div>
        )}
      </div>
    </div>
  );
}

function SubStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[var(--kf-card-sub)] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] text-[var(--kf-ink-3)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[18px] font-semibold leading-none tabular-nums text-[var(--kf-ink)]">
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 pb-2 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-3">{children}</td>;
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
      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
        active
          ? "bg-[var(--kf-card)] text-[var(--kf-ink)] shadow-[var(--kf-shadow-sm)]"
          : "text-[var(--kf-ink-3)]"
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
    return <span style={{ color: "var(--kf-fail)" }}>optimisation failed</span>;
  if (!status) return <span>no run yet</span>;
  return (
    <span style={{ color: "var(--kf-running)" }}>
      Devin optimising{detail ? ` (${detail.replace(/_/g, " ")})` : "…"}
    </span>
  );
}

function ProviderLabel({ provider }: { provider: string }) {
  const map: Record<string, { label: string; color: string }> = {
    "context.dev": { label: "CONTEXT.DEV", color: "#2b8fd6" },
    convex: { label: "CONVEX", color: "#d98324" },
    devin: { label: "DEVIN", color: "#7c5cd6" },
    loadshare: { label: "LOADSHARE", color: "var(--kf-accent)" },
  };
  const s = map[provider] ?? {
    label: provider.toUpperCase(),
    color: "var(--kf-ink-3)",
  };
  return (
    <span
      className="w-[86px] shrink-0 font-mono text-[9.5px] font-semibold tracking-[0.08em]"
      style={{ color: s.color }}
    >
      {s.label}
    </span>
  );
}
