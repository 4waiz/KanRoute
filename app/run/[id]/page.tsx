"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ExternalLink,
  Globe,
  Leaf,
  Radio,
  Route as RouteIcon,
  Terminal,
  Truck,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LoadShareWordmark } from "@/components/Brand";
import { DubaiMap } from "@/components/DubaiMap";
import { CardHeader, KpiNumber, LeaderRow, OutcomeGauge } from "@/components/kf-ui";

const DEPOT = { name: "Al Quoz Consolidation Hub", lat: 25.13, lng: 55.22 };

type RunDoc = {
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
  optimiserCode?: string;
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
  sourceUrl?: string;
};

type TraceEvent = {
  _id: string;
  provider: string;
  message: string;
  timestamp: number;
};

export default function RunPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id as Id<"runs">;

  const run = useQuery(api.runs.get, { runId }) as RunDoc | null | undefined;
  const shipments = useQuery(api.runs.shipments, { runId }) as
    | ShipmentDoc[]
    | undefined;
  const routes = useQuery(api.runs.routes, { runId }) as RouteDoc[] | undefined;
  const suppliers = useQuery(api.suppliers.list, {}) as
    | SupplierDoc[]
    | undefined;
  const events = useQuery(api.events.byRun, { runId, limit: 40 }) as
    | TraceEvent[]
    | undefined;

  const [showConsolidated, setShowConsolidated] = useState(true);

  const done = run?.status === "completed";
  const kmSaved = Math.max(
    0,
    Math.round(((run?.baselineKm ?? 0) - (run?.consolidatedKm ?? 0)) * 10) / 10,
  );
  const co2Saved = Math.max(
    0,
    Math.round(
      ((run?.baselineCo2Kg ?? 0) - (run?.consolidatedCo2Kg ?? 0)) * 10,
    ) / 10,
  );
  const vansSaved = Math.max(
    0,
    (run?.baselineTrips ?? 0) - (run?.routeCount ?? 0),
  );
  const pctKm =
    run?.baselineKm && run.baselineKm > 0
      ? Math.round((kmSaved / run.baselineKm) * 100)
      : 0;

  const mapRoutes = useMemo(
    () =>
      (routes ?? []).map((r) => ({
        label: r.label,
        zone: r.zone,
        shipmentRefs: r.shipmentRefs,
      })),
    [routes],
  );

  return (
    <main className="min-h-screen p-3 sm:p-5">
      <div className="kf-shell mx-auto max-w-[1560px] p-4 sm:p-6">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-6 px-1">
          <div className="min-w-0">
            <Link href="/" className="mb-3 inline-block">
              <LoadShareWordmark compact />
            </Link>
            <h1 className="text-[34px] font-semibold leading-none tracking-tight text-[var(--kf-ink)] sm:text-[44px]">
              {run?.name ?? "Consolidation run"}
            </h1>
            <p className="mt-2.5 text-[13px] text-[var(--kf-ink-2)]">
              {run?.shipmentCount ?? 0} consignments across Dubai ·{" "}
              {run?.vehicleCapacityKg ?? 0} kg vehicles ·{" "}
              <StatusText status={run?.status} detail={run?.devinStatusDetail} />
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-8">
            <KpiNumber
              value={done ? `${run?.baselineTrips} to ${run?.routeCount}` : "-"}
              label="Vans required"
              pill={done ? `${vansSaved} fewer` : undefined}
              pillColor="var(--kf-pass)"
            />
            <KpiNumber
              value={done ? `${pctKm}%` : "-"}
              label="Distance removed"
              pill={done ? `${kmSaved} km` : undefined}
              pillColor="var(--kf-accent)"
            />
          </div>
        </header>

        {/* Impact banner */}
        {done && (
          <div className="kf-pill-dark kf-enter mb-4 flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
            <div>
              <div className="text-[16px] font-semibold tracking-tight text-white">
                {run?.baselineTrips} separate vans became {run?.routeCount}{" "}
                consolidated routes.
              </div>
              <div className="mt-1 text-[13px] text-white/60">
                Every consignment still delivered, inside each supplier&apos;s real
                receiving window.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <DarkStat
                icon={<Truck className="h-4 w-4" />}
                value={`${vansSaved}`}
                label="fewer vehicles"
              />
              <DarkStat
                icon={<RouteIcon className="h-4 w-4" />}
                value={`${kmSaved} km`}
                label="not driven"
              />
              <DarkStat
                icon={<Leaf className="h-4 w-4" />}
                value={`${co2Saved} kg`}
                label="CO2 avoided"
                color="var(--kf-pass)"
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-4">
            {/* Map */}
            <div className="kf-card">
              <CardHeader
                title="Dubai operating area"
                sub={
                  showConsolidated
                    ? "Consolidated routes, coloured per vehicle"
                    : "Status quo: one dedicated van per consignment"
                }
                right={
                  <div className="flex rounded-full bg-[var(--kf-card-sub)] p-1">
                    <Toggle
                      active={!showConsolidated}
                      onClick={() => setShowConsolidated(false)}
                    >
                      Before
                    </Toggle>
                    <Toggle
                      active={showConsolidated}
                      onClick={() => setShowConsolidated(true)}
                    >
                      After
                    </Toggle>
                  </div>
                }
              />
              <div className="px-5 pb-5">
                <DubaiMap
                  depot={DEPOT}
                  shipments={shipments ?? []}
                  routes={mapRoutes}
                  consolidated={showConsolidated && done}
                />
              </div>
            </div>

            {/* Routes */}
            <div className="kf-card">
              <CardHeader
                title="Consolidated routes"
                sub="Produced and constraint-checked by Devin"
              />
              <div className="px-3 pb-4">
                {(routes ?? []).length === 0 ? (
                  <div className="px-2 py-8 text-center">
                    <div className="relative mx-auto h-2 w-44 overflow-hidden rounded-full bg-[var(--kf-card-sub)] kf-sweep" />
                    <p className="mt-4 text-[12.5px] text-[var(--kf-ink-3)]">
                      Devin is writing and running the optimiser
                    </p>
                  </div>
                ) : (
                  (routes ?? []).map((r, i) => (
                    <div
                      key={r._id}
                      className="kf-enter mb-1.5 flex flex-wrap items-center gap-3 rounded-2xl px-3 py-3 hover:bg-[var(--kf-card-sub)]"
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
                        style={{ background: ROUTE_COLORS[i % ROUTE_COLORS.length] }}
                      >
                        {r.label}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-[var(--kf-ink)]">
                          {r.zone}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-[var(--kf-ink-3)]">
                          {r.shipmentRefs.join(" · ")}
                        </span>
                      </span>
                      <Stat label="Stops" value={r.stopCount} />
                      <Stat label="Load" value={`${r.loadKg} kg`} />
                      <Stat label="Distance" value={`${r.distanceKm} km`} />
                      <Stat
                        label="Window"
                        value={`${r.windowStart ?? "-"}-${r.windowEnd ?? "-"}`}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Proof */}
            {run?.proofOutput && (
              <div className="kf-card overflow-hidden">
                <CardHeader
                  title="Feasibility proof"
                  sub="Verbatim output from the constraint checker Devin executed"
                  right={
                    run.feasible ? (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--kf-pass)_14%,white)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--kf-pass)]">
                        Feasible
                      </span>
                    ) : (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--kf-fail)_14%,white)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--kf-fail)]">
                        Infeasible
                      </span>
                    )
                  }
                />
                <div className="px-5 pb-5">
                  <div className="overflow-hidden rounded-2xl bg-[var(--kf-ink)]">
                    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
                      <Terminal className="h-3.5 w-3.5 text-white/45" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                        python checker.py
                      </span>
                    </div>
                    <pre className="max-h-64 overflow-auto px-4 py-3.5 font-mono text-[11px] leading-relaxed text-white/80">
                      {run.proofOutput}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Gauge */}
            <div className="kf-card">
              <CardHeader title="Fleet impact" sub="Baseline against consolidated" />
              <div className="flex flex-col items-center px-5 pb-5">
                <OutcomeGauge
                  size={190}
                  total={done ? (run?.routeCount ?? 0) : (run?.baselineTrips ?? 0)}
                  caption={done ? "vehicles needed" : "vehicles today"}
                  segments={[
                    {
                      label: "Consolidated",
                      value: run?.routeCount ?? 0,
                      color: "var(--kf-accent)",
                    },
                    {
                      label: "Removed",
                      value: vansSaved,
                      color: "rgba(12,18,17,0.12)",
                    },
                  ]}
                />
                <div className="mt-2 w-full">
                  <LeaderRow
                    color="rgba(12,18,17,0.3)"
                    label="Vans today"
                    value={run?.baselineTrips ?? 0}
                  />
                  <LeaderRow
                    color="var(--kf-accent)"
                    label="Vans after"
                    value={run?.routeCount ?? 0}
                  />
                  <LeaderRow
                    color="var(--kf-ink-3)"
                    label="Distance today"
                    value={`${run?.baselineKm ?? 0} km`}
                  />
                  <LeaderRow
                    color="var(--kf-pass)"
                    label="Distance after"
                    value={`${run?.consolidatedKm ?? 0} km`}
                  />
                </div>
              </div>
            </div>

            {/* Supplier provenance */}
            <div className="kf-card">
              <CardHeader
                title="Supplier data"
                sub="Read live from each company website"
                right={
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--kf-card-sub)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#2b8fd6]">
                    <Globe className="h-3 w-3" />
                    Context.dev
                  </span>
                }
              />
              <div className="space-y-2.5 px-5 pb-5">
                {(suppliers ?? []).map((s) => (
                  <div
                    key={s._id}
                    className="rounded-2xl bg-[var(--kf-card-sub)] px-3.5 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[var(--kf-ink)]">
                        {s.name}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-[var(--kf-ink-2)]">
                        {s.receivingFrom ?? "?"}-{s.receivingTo ?? "?"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-snug text-[var(--kf-ink-2)]">
                      {s.address ?? "No address found"}
                    </p>
                    {s.notes && (
                      <p className="mt-1 text-[10.5px] italic leading-snug text-[var(--kf-ink-3)]">
                        {s.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Devin session */}
            {run?.devinSessionId && (
              <div className="kf-card">
                <CardHeader title="Devin session" sub="Optimiser run" />
                <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
                  <code className="rounded-lg bg-[var(--kf-card-sub)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--kf-ink-2)]">
                    {run.devinSessionId.slice(0, 18)}
                  </code>
                  {run.devinSessionUrl && (
                    <a
                      href={run.devinSessionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--kf-running)] hover:underline"
                    >
                      View session
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Trace */}
            <div className="kf-card overflow-hidden">
              <CardHeader
                title="Activity"
                sub="Real provider events"
                right={
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--kf-card-sub)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--kf-ink-2)]">
                    <Radio className="h-3 w-3" style={{ color: "var(--kf-pass)" }} />
                    Live
                  </span>
                }
              />
              <div className="max-h-[320px] overflow-y-auto px-5 pb-5">
                {(events ?? []).length === 0 ? (
                  <p className="text-[12.5px] text-[var(--kf-ink-3)]">
                    Waiting for activity...
                  </p>
                ) : (
                  <ol>
                    {(events ?? []).map((e) => (
                      <li key={e._id} className="kf-enter flex gap-3 py-2">
                        <span className="mt-0.5 w-[50px] shrink-0 font-mono text-[10px] tabular-nums text-[var(--kf-ink-3)]">
                          {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                            hour12: false,
                          })}
                        </span>
                        <span className="min-w-0 flex-1">
                          <ProviderLabel provider={e.provider} />
                          <span className="mt-0.5 block text-[12px] leading-snug text-[var(--kf-ink-2)]">
                            {e.message}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 px-1 text-[11px] leading-relaxed text-[var(--kf-ink-3)]">
          Supplier addresses and receiving hours are read live from each
          company&apos;s public website. Consignment volumes are synthetic test
          data. No affiliation with the named businesses is implied.
        </p>
      </div>
    </main>
  );
}

const ROUTE_COLORS = [
  "#ff6b2c",
  "#3d8bff",
  "#35c46b",
  "#7c5cd6",
  "#d98324",
  "#e0428f",
];

function StatusText({
  status,
  detail,
}: {
  status?: string;
  detail?: string;
}) {
  if (status === "completed") {
    return <span style={{ color: "var(--kf-pass)" }}>plan ready</span>;
  }
  if (status === "failed" || status === "timeout") {
    return <span style={{ color: "var(--kf-fail)" }}>optimisation failed</span>;
  }
  return (
    <span style={{ color: "var(--kf-running)" }}>
      Devin optimising{detail ? ` (${detail.replace(/_/g, " ")})` : "..."}
    </span>
  );
}

function DarkStat({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/70">
        {icon}
      </span>
      <span>
        <span
          className="block text-[18px] font-semibold leading-none tabular-nums"
          style={{ color: color ?? "#fff" }}
        >
          {value}
        </span>
        <span className="mt-1 block text-[11px] text-white/50">{label}</span>
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="shrink-0 text-right">
      <span className="block text-[9.5px] uppercase tracking-[0.12em] text-[var(--kf-ink-3)]">
        {label}
      </span>
      <span className="block text-[12.5px] font-semibold tabular-nums text-[var(--kf-ink)]">
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
      className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${
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
      className="font-mono text-[9.5px] font-semibold tracking-[0.1em]"
      style={{ color: s.color }}
    >
      {s.label}
    </span>
  );
}
