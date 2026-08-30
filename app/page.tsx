"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Globe,
  Leaf,
  Loader2,
  Radio,
  Terminal,
  Truck,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LoadShareWordmark } from "@/components/Brand";
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

type RunDoc = {
  _id: string;
  name: string;
  status: string;
  error?: string;
  shipmentCount?: number;
  vehicleCapacityKg?: number;
  baselineTrips?: number;
  baselineKm?: number;
  baselineCo2Kg?: number;
  routeCount?: number;
  consolidatedKm?: number;
  consolidatedCo2Kg?: number;
  devinSessionId?: string;
  devinSessionUrl?: string;
  devinStatusDetail?: string;
  feasible?: boolean;
  proofOutput?: string;
};

type ShipmentDoc = {
  _id: string;
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
  status: string;
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
  website: string;
  status: string;
  address?: string;
  receivingFrom?: string;
  receivingTo?: string;
  notes?: string;
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

  const latest = useQuery(api.runs.latest, {}) as RunDoc | null | undefined;
  const runId = latest?._id as Id<"runs"> | undefined;

  const suppliers = useQuery(api.suppliers.list, {}) as SupplierDoc[] | undefined;
  const shipments = useQuery(
    api.runs.shipments,
    runId ? { runId } : "skip",
  ) as ShipmentDoc[] | undefined;
  const routes = useQuery(api.runs.routes, runId ? { runId } : "skip") as
    | RouteDoc[]
    | undefined;
  const events = useQuery(
    api.events.byRun,
    runId ? { runId, limit: 40 } : "skip",
  ) as TraceEvent[] | undefined;

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consolidated, setConsolidated] = useState(true);
  // Track only what the user explicitly hid; everything else is visible.
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showProof, setShowProof] = useState(false);

  const done = latest?.status === "completed";
  const mappable = (suppliers ?? []).filter(
    (s) => s.status === "enriched" && s.lat != null,
  );

  const kmSaved = Math.max(
    0,
    Math.round(((latest?.baselineKm ?? 0) - (latest?.consolidatedKm ?? 0)) * 10) /
      10,
  );
  const co2Saved = Math.max(
    0,
    Math.round(
      ((latest?.baselineCo2Kg ?? 0) - (latest?.consolidatedCo2Kg ?? 0)) * 10,
    ) / 10,
  );
  const vansSaved = Math.max(
    0,
    (latest?.baselineTrips ?? 0) - (latest?.routeCount ?? 0),
  );
  const pctKm =
    latest?.baselineKm && latest.baselineKm > 0
      ? Math.round((kmSaved / latest.baselineKm) * 100)
      : 0;

  const zones = useMemo(
    () => new Set((shipments ?? []).map((s) => s.destinationZone)).size,
    [shipments],
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
    <main className="min-h-screen p-2 sm:p-4">
      <div className="kf-shell mx-auto max-w-[1700px] p-3 sm:p-5">
        {/* Header */}
        <header className="mb-3 flex flex-wrap items-center justify-between gap-4 px-1">
          <div className="flex flex-wrap items-center gap-5">
            <LoadShareWordmark compact />
            <div className="hidden h-9 w-px bg-[var(--kf-border)] sm:block" />
            <div>
              <h1 className="text-[22px] font-semibold leading-none tracking-tight text-[var(--kf-ink)] sm:text-[26px]">
                Dubai last-mile consolidation
              </h1>
              <p className="mt-1.5 text-[12px] text-[var(--kf-ink-2)]">
                {latest?.shipmentCount ?? 0} consignments · {zones} drop zones ·{" "}
                {mappable.length} mapped suppliers ·{" "}
                <StatusText
                  status={latest?.status}
                  detail={latest?.devinStatusDetail}
                />
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={loadSuppliers}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--kf-card-sub)] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--kf-ink-2)] transition hover:text-[var(--kf-ink)] disabled:opacity-50"
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
        </header>

        {error && (
          <p className="mb-3 px-1 text-[13px] text-[var(--kf-fail)]">{error}</p>
        )}

        {/* Impact strip */}
        <div className="kf-pill-dark mb-3 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-3.5">
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-white">
              {done
                ? `${latest?.baselineTrips} separate vans became ${latest?.routeCount} consolidated routes.`
                : "Waiting for a consolidation plan."}
            </div>
            <div className="mt-0.5 text-[12px] text-white/55">
              Every consignment delivered inside its supplier&apos;s real
              receiving window.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
            <DarkStat icon={<Truck className="h-4 w-4" />} value={`${vansSaved}`} label="fewer vans" />
            <DarkStat value={`${kmSaved} km`} label={`not driven (${pctKm}%)`} />
            <DarkStat
              icon={<Leaf className="h-4 w-4" />}
              value={`${co2Saved} kg`}
              label="CO2 avoided"
              color="#4fd98a"
            />
          </div>
        </div>

        {/* Main: route list + map */}
        <div className="grid gap-3 lg:grid-cols-[330px_minmax(0,1fr)]">
          {/* Route list */}
          <div className="kf-card flex max-h-[620px] flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 pb-2.5 pt-4">
              <div>
                <h2 className="text-[14px] font-semibold tracking-tight text-[var(--kf-ink)]">
                  Routes
                </h2>
                <p className="mt-0.5 text-[11.5px] text-[var(--kf-ink-3)]">
                  {selected ? "Showing one route" : "Click to isolate"}
                </p>
              </div>
              <div className="flex rounded-full bg-[var(--kf-card-sub)] p-1">
                <Toggle active={!consolidated} onClick={() => setConsolidated(false)}>
                  Before
                </Toggle>
                <Toggle active={consolidated} onClick={() => setConsolidated(true)}>
                  After
                </Toggle>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {(routes ?? []).length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <div className="relative mx-auto h-2 w-40 overflow-hidden rounded-full bg-[var(--kf-card-sub)] kf-sweep" />
                  <p className="mt-4 text-[12px] text-[var(--kf-ink-3)]">
                    Devin is writing and running the optimiser
                  </p>
                </div>
              ) : (
                (routes ?? []).map((r, i) => {
                  const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
                  const on = visible[r.label] !== false;
                  const isSel = selected === r.label;
                  return (
                    <div
                      key={r._id}
                      onClick={() => setSelected(isSel ? null : r.label)}
                      className={`kf-enter mb-1.5 cursor-pointer rounded-xl px-2.5 py-2.5 transition ${
                        isSel
                          ? "bg-[var(--kf-card-sub)] ring-2"
                          : "hover:bg-[var(--kf-card-sub)]"
                      }`}
                      style={isSel ? { boxShadow: `inset 0 0 0 2px ${color}` } : {}}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => {
                            e.stopPropagation();
                            setHidden((h) =>
                              on ? [...h, r.label] : h.filter((x) => x !== r.label),
                            );
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 shrink-0 accent-[var(--kf-accent)]"
                        />
                        <span
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
                          style={{ background: color, opacity: on ? 1 : 0.35 }}
                        >
                          {r.label}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[var(--kf-ink)]">
                            {r.zone}
                          </span>
                          <span className="block font-mono text-[10.5px] text-[var(--kf-ink-3)]">
                            {r.stopCount} stops · {r.loadKg} kg ·{" "}
                            {r.distanceKm} km
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 pl-[26px] font-mono text-[10px] text-[var(--kf-ink-3)]">
                        <span
                          className="rounded px-1.5 py-0.5"
                          style={{
                            background: `color-mix(in srgb, ${color} 14%, white)`,
                            color,
                          }}
                        >
                          {r.windowStart}-{r.windowEnd}
                        </span>
                        <span className="truncate">{r.shipmentRefs.join(" ")}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-[var(--kf-border)] px-4 py-3">
              <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                <Mini label="Routes" value={latest?.routeCount ?? 0} />
                <Mini label="Consignments" value={latest?.shipmentCount ?? 0} />
                <Mini label="Baseline" value={`${latest?.baselineKm ?? 0} km`} />
                <Mini
                  label="Consolidated"
                  value={`${latest?.consolidatedKm ?? 0} km`}
                  accent="var(--kf-pass)"
                />
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="kf-card overflow-hidden p-2">
            <div className="h-[620px] w-full">
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

        {/* Lower row */}
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Proof */}
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
                  Verbatim output from the constraint checker Devin executed
                </p>
              </div>
              <div className="flex items-center gap-2.5">
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
                  <pre className="max-h-80 overflow-auto px-4 py-3.5 font-mono text-[11px] leading-relaxed text-white/80">
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

          {/* Suppliers */}
          <div className="kf-card flex max-h-[420px] flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 pb-2.5 pt-4">
              <div>
                <h2 className="text-[14px] font-semibold tracking-tight text-[var(--kf-ink)]">
                  Supplier data
                </h2>
                <p className="mt-0.5 text-[11.5px] text-[var(--kf-ink-3)]">
                  Read live from each company website
                </p>
              </div>
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
                    style={{ opacity: usable ? 1 : 0.55 }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-[var(--kf-ink)]">
                        {s.name}
                      </span>
                      <span
                        className="font-mono text-[10.5px] font-semibold"
                        style={{
                          color: usable
                            ? "var(--kf-pass)"
                            : "var(--kf-ink-3)",
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
          <div className="max-h-[200px] overflow-y-auto px-5 pb-4">
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

        <p className="mt-4 px-1 text-[10.5px] leading-relaxed text-[var(--kf-ink-3)]">
          Supplier addresses and receiving hours are read live from each
          company&apos;s public website. Consignment volumes and destinations are
          synthetic test data. Area coordinates are district level. No
          affiliation with the named businesses is implied.
        </p>
      </div>
    </main>
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

function DarkStat({
  icon,
  value,
  label,
  color,
}: {
  icon?: React.ReactNode;
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {icon && (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/70">
          {icon}
        </span>
      )}
      <span>
        <span
          className="block text-[17px] font-semibold leading-none tabular-nums"
          style={{ color: color ?? "#fff" }}
        >
          {value}
        </span>
        <span className="mt-1 block text-[10.5px] text-white/50">{label}</span>
      </span>
    </div>
  );
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <span>
      <span className="block text-[9.5px] uppercase tracking-[0.12em] text-[var(--kf-ink-3)]">
        {label}
      </span>
      <span
        className="block text-[13px] font-semibold tabular-nums"
        style={{ color: accent ?? "var(--kf-ink)" }}
      >
        {value}
      </span>
    </span>
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
