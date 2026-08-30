"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Panel } from "@/components/Shell";

type Cfg = {
  vehicleCapacityKg: number;
  costRateAed: number;
  co2PerKm: number;
  detourFactor: number;
  avgSpeedKmh: number;
  maxPages: number;
};

const FIELDS: {
  key: keyof Cfg;
  label: string;
  unit: string;
  step: number;
  help: string;
}[] = [
  {
    key: "vehicleCapacityKg",
    label: "Vehicle capacity",
    unit: "kg",
    step: 50,
    help: "Cap Devin must respect when grouping consignments.",
  },
  {
    key: "costRateAed",
    label: "Operating cost",
    unit: "AED/km",
    step: 0.1,
    help: "Fuel, driver, maintenance. Drives the cost avoided figure.",
  },
  {
    key: "co2PerKm",
    label: "Emissions factor",
    unit: "kg CO2e/km",
    step: 0.01,
    help: "Diesel light commercial vehicle, well to wheel.",
  },
  {
    key: "detourFactor",
    label: "Urban detour factor",
    unit: "x",
    step: 0.05,
    help: "Straight-line distance is multiplied by this to approximate roads.",
  },
  {
    key: "avgSpeedKmh",
    label: "Average speed",
    unit: "km/h",
    step: 1,
    help: "Used for ETA and driver time saved.",
  },
  {
    key: "maxPages",
    label: "Pages per supplier",
    unit: "pages",
    step: 1,
    help: "How deep Context.dev crawls each supplier site.",
  },
];

export default function SettingsView() {
  const saved = useQuery(api.settings.get, {}) as (Cfg & { _id: string | null }) | undefined;
  const update = useMutation(api.settings.update);
  const reset = useMutation(api.settings.reset);

  // Overrides layer on top of the saved row, so there is no effect syncing
  // server state into local state.
  const [edits, setEdits] = useState<Partial<Cfg>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const draft: Cfg | null = saved
    ? {
        vehicleCapacityKg: edits.vehicleCapacityKg ?? saved.vehicleCapacityKg,
        costRateAed: edits.costRateAed ?? saved.costRateAed,
        co2PerKm: edits.co2PerKm ?? saved.co2PerKm,
        detourFactor: edits.detourFactor ?? saved.detourFactor,
        avgSpeedKmh: edits.avgSpeedKmh ?? saved.avgSpeedKmh,
        maxPages: edits.maxPages ?? saved.maxPages,
      }
    : null;

  const dirty =
    draft !== null &&
    saved !== undefined &&
    FIELDS.some((f) => draft[f.key] !== saved[f.key]);

  async function save() {
    if (!draft) return;
    setBusy("save");
    setNote(null);
    try {
      await update(draft);
      setEdits({});
      setNote("Saved. Applies to the next consolidation run.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("reset");
    setNote(null);
    try {
      await reset({});
      setEdits({});
      setNote("Restored defaults.");
    } catch {
      setNote("Could not reset.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid min-h-0 gap-2.5 lg:h-full lg:grid-cols-[minmax(0,1fr)_330px]">
      <Panel
        title="Operating parameters"
        sub="These drive the optimiser and every savings figure"
        right={
          <div className="flex shrink-0 gap-1.5">
            <button
              onClick={restore}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--kf-card-sub)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--kf-ink-2)] disabled:opacity-50"
            >
              {busy === "reset" ? (
                <Loader2 className="h-3 w-3 kf-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Defaults
            </button>
            <button
              onClick={save}
              disabled={busy !== null || !dirty}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--kf-accent)" }}
            >
              {busy === "save" ? (
                <Loader2 className="h-3 w-3 kf-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save
            </button>
          </div>
        }
        bodyClassName="px-3 pb-3"
      >
        {draft ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label
                key={f.key}
                className="rounded-xl bg-[var(--kf-card-sub)] px-3 py-2.5"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[11.5px] font-semibold text-[var(--kf-ink)]">
                    {f.label}
                  </span>
                  <span className="font-mono text-[9.5px] text-[var(--kf-ink-3)]">
                    {f.unit}
                  </span>
                </span>
                <input
                  type="number"
                  step={f.step}
                  value={draft[f.key]}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [f.key]: Number(e.target.value),
                    }))
                  }
                  className="mt-1.5 w-full rounded-lg bg-[var(--kf-card)] px-2.5 py-1.5 font-mono text-[13px] text-[var(--kf-ink)] outline-none ring-1 ring-[var(--kf-border)] focus:ring-[var(--kf-accent)]"
                />
                <span className="mt-1 block text-[9.5px] leading-snug text-[var(--kf-ink-3)]">
                  {f.help}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-[11.5px] text-[var(--kf-ink-3)]">
            Loading…
          </p>
        )}
        {note && (
          <p className="mt-2 text-[11px] text-[var(--kf-ink-2)]">{note}</p>
        )}
      </Panel>

      <Panel title="Method" sub="How the numbers are produced" bodyClassName="px-3 pb-3">
        <div className="space-y-2 text-[11px] leading-relaxed text-[var(--kf-ink-2)]">
          <p>
            <b className="text-[var(--kf-ink)]">Baseline.</b> One dedicated van
            per consignment: depot to supplier, supplier to drop, drop to depot.
          </p>
          <p>
            <b className="text-[var(--kf-ink)]">Distance.</b> Haversine between
            district-level coordinates, multiplied by the detour factor. Applied
            identically to baseline and consolidated so the comparison is fair.
          </p>
          <p>
            <b className="text-[var(--kf-ink)]">Feasibility.</b> Devin writes a
            constraint checker and runs it. Capacity, a minimum 60 minute window
            intersection, one drop zone per route, and complete non-duplicated
            coverage are all asserted, and the raw stdout is stored.
          </p>
          <p>
            <b className="text-[var(--kf-ink)]">Data.</b> Supplier addresses and
            receiving hours are read live from company websites. Consignment
            weights and destinations are synthetic. The dispatch clock is
            simulated; the plan and distances are not.
          </p>
        </div>
      </Panel>
    </div>
  );
}
