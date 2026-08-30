"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type Summary = {
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

export type RunDoc = {
  _id: string;
  status: string;
  shipmentCount?: number;
  vehicleCapacityKg?: number;
  devinSessionId?: string;
  devinSessionUrl?: string;
  devinStatusDetail?: string;
  feasible?: boolean;
  proofOutput?: string;
  optimiserCode?: string;
  strategy?: string;
  disruption?: string;
  companiesServed?: number;
};

export type ShipmentDoc = {
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

export type RouteDoc = {
  _id: string;
  label: string;
  zone: string;
  stopCount: number;
  loadKg: number;
  distanceKm: number;
  windowStart?: string;
  windowEnd?: string;
  shipmentRefs: string[];
  companies?: string[];
  rationale?: string;
};

export type SupplierDoc = {
  _id: string;
  name: string;
  website: string;
  status: string;
  address?: string;
  emirate?: string;
  receivingFrom?: string;
  receivingTo?: string;
  notes?: string;
  sourceUrl?: string;
  lat?: number;
};

export type TraceEvent = {
  _id: string;
  provider: string;
  message: string;
  timestamp: number;
};

/** Shared reactive state for every console view. */
export function useConsole() {
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
    runId ? { runId, limit: 60 } : "skip",
  ) as TraceEvent[] | undefined;

  const done = latest?.status === "completed";

  return { stats, latest, runId, suppliers, shipments, routes, events, done };
}

/** Route visibility and isolation, shared by the map-bearing views. */
export function useRouteSelection(routes: RouteDoc[] | undefined) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

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

  function toggle(label: string) {
    setHidden((h) =>
      h.includes(label) ? h.filter((x) => x !== label) : [...h, label],
    );
  }

  return { hidden, setHidden, selected, setSelected, visible, mapRoutes, toggle };
}
