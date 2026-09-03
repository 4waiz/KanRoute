"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Gauge, Leaf, Radio, Truck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { FleetStatus, type Vehicle } from "@/components/Fleet";
import { Panel } from "@/components/Shell";
import { useConsole } from "@/components/useConsole";

export default function FleetView() {
  const vehicles = useQuery(api.fleet.list, {}) as Vehicle[] | undefined;
  const dispatchFleet = useMutation(api.fleet.dispatch);
  const resetFleet = useMutation(api.fleet.reset);
  const { events } = useConsole();
  const [busy, setBusy] = useState(false);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const list = vehicles ?? [];
  const enRoute = list.filter((v) => v.status === "en_route");
  const kmSaved = list.reduce((a, v) => a + v.kmSaved, 0);
  const co2Saved = list.reduce((a, v) => a + v.co2SavedKg, 0);
  const costSaved = list.reduce((a, v) => a + v.costSavedAed, 0);
  const minutesSaved = list.reduce((a, v) => a + v.minutesSaved, 0);
  const stopsDone = list.reduce((a, v) => a + v.stopsCompleted, 0);
  const stopsTotal = list.reduce((a, v) => a + v.stopsTotal, 0);

  return (
    <div className="grid min-h-0 gap-2.5 lg:h-full lg:grid-rows-[auto_minmax(0,1fr)]">
      <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Vehicles" value={list.length} icon={<Truck className="h-3.5 w-3.5" />} />
        <Stat
          label="In transit"
          value={enRoute.length}
          valueColor="var(--kf-accent)"
          icon={<Radio className="h-3.5 w-3.5" />}
        />
        <Stat label="Stops" value={`${stopsDone}/${stopsTotal}`} />
        <Stat
          label="Distance avoided"
          value={`${Math.round(kmSaved)} km`}
          valueColor="var(--kf-pass)"
        />
        <Stat
          label="CO2 avoided"
          value={`${Math.round(co2Saved)} kg`}
          valueColor="var(--kf-pass)"
          icon={<Leaf className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Cost avoided"
          value={`AED ${costSaved.toLocaleString()}`}
          sub={`${Math.round(minutesSaved / 60)} h driver time`}
          icon={<Gauge className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid min-h-0 gap-2.5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <FleetStatus
          vehicles={list}
          busy={busy}
          onDispatch={() => act(() => dispatchFleet({}))}
          onReset={() => act(() => resetFleet({}))}
        />

        <Panel
          title="Dispatch activity"
          sub="Real recorded events"
          bodyClassName="px-3 pb-3"
        >
          <ol>
            {(events ?? []).map((e) => (
              <li key={e._id} className="flex gap-2 py-1">
                <span className="w-[44px] shrink-0 font-mono text-[9px] tabular-nums text-[var(--kf-ink-3)]">
                  {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                    hour12: false,
                  })}
                </span>
                <span className="min-w-0 flex-1 text-[10.5px] leading-snug text-[var(--kf-ink-2)]">
                  {e.message}
                </span>
              </li>
            ))}
          </ol>
          {(events ?? []).length === 0 && (
            <p className="py-6 text-center text-[11.5px] text-[var(--kf-ink-3)]">
              No activity yet.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="kf-card px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[var(--kf-ink-2)]">
          {label}
        </span>
        {icon && <span className="text-[var(--kf-ink-3)]">{icon}</span>}
      </div>
      <div
        className="mt-1.5 text-[21px] font-semibold leading-none tabular-nums"
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
