"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Gauge,
  Leaf,
  MapPin,
  Package,
  Truck,
  X,
} from "lucide-react";
import { ROUTE_COLORS } from "@/lib/routeColors";

export type Vehicle = {
  _id: string;
  label: string;
  plate: string;
  driver: string;
  zone: string;
  status: "idle" | "en_route" | "completed";
  stopsTotal: number;
  stopsCompleted: number;
  loadKg: number;
  distanceKm: number;
  baselineKm: number;
  shipmentRefs: string[];
  windowStart?: string;
  windowEnd?: string;
  progress: number;
  deliveriesTotal: number;
  deliveriesDone: number;
  kmSaved: number;
  co2SavedKg: number;
  costSavedAed: number;
  minutesSaved: number;
  etaMinutes: number;
};

function statusStyle(status: Vehicle["status"]) {
  if (status === "en_route")
    return { label: "In transit", color: "var(--kf-accent)" };
  if (status === "completed")
    return { label: "Complete", color: "var(--kf-pass)" };
  return { label: "Idle", color: "var(--kf-ink-3)" };
}

/**
 * Fleet status board. Each row is one vehicle running one proven route;
 * selecting it opens the operational detail for that vehicle.
 */
export function FleetStatus({
  vehicles,
  onDispatch,
  onReset,
  busy,
  dataTour,
}: {
  vehicles: Vehicle[];
  onDispatch: () => void;
  onReset: () => void;
  busy: boolean;
  /** Anchors the guided tour's spotlight to this panel. */
  dataTour?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = vehicles.find((v) => v._id === openId) ?? null;

  const enRoute = vehicles.filter((v) => v.status === "en_route").length;
  const complete = vehicles.filter((v) => v.status === "completed").length;
  const totalDeliveries = vehicles.reduce((a, v) => a + v.deliveriesTotal, 0);
  const doneDeliveries = vehicles.reduce((a, v) => a + v.deliveriesDone, 0);

  return (
    <div
      data-tour={dataTour}
      className="kf-card flex min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2.5 pt-3.5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--kf-ink)]">
            Fleet status
          </h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--kf-ink-3)]">
            Vehicles running the current plan
          </p>
        </div>
        <div className="flex items-center gap-2">
          {vehicles.length > 0 && (
            <button
              onClick={onReset}
              disabled={busy}
              className="rounded-full bg-[var(--kf-card-sub)] px-3.5 py-2 text-[11.5px] font-semibold text-[var(--kf-ink-2)] transition hover:text-[var(--kf-ink)] disabled:opacity-50"
            >
              Restart day
            </button>
          )}
          <button
            onClick={onDispatch}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11.5px] font-semibold transition disabled:opacity-50"
            style={{ background: "var(--kf-solid)", color: "var(--kf-solid-fg)" }}
          >
            <Truck className="h-3.5 w-3.5" />
            Dispatch fleet
          </button>
        </div>
      </div>

      {/* Counters */}
      <div className="mx-4 mb-2.5 grid grid-cols-4 gap-1.5">
        <Counter label="Vehicles" value={vehicles.length} />
        <Counter label="In transit" value={enRoute} color="var(--kf-accent)" />
        <Counter label="Complete" value={complete} color="var(--kf-pass)" />
        <Counter
          label="Deliveries"
          value={`${doneDeliveries}/${totalDeliveries}`}
        />
      </div>

      {vehicles.length === 0 ? (
        <p className="px-5 pb-6 text-[12.5px] text-[var(--kf-ink-3)]">
          No vehicles dispatched. Run a consolidation, then dispatch the fleet
          against the proven plan.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
          {vehicles.map((vh, i) => {
            const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
            const st = statusStyle(vh.status);
            return (
              <button
                key={vh._id}
                onClick={() => setOpenId(openId === vh._id ? null : vh._id)}
                className={`kf-enter mb-1.5 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                  openId === vh._id
                    ? "bg-[var(--kf-card-sub)]"
                    : "hover:bg-[var(--kf-card-sub)]"
                }`}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: `color-mix(in srgb, ${color} 16%, var(--kf-mix))` }}
                >
                  <Truck className="h-4 w-4" style={{ color }} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-[var(--kf-ink)]">
                      {vh.plate}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                      style={{
                        background: `color-mix(in srgb, ${st.color} 15%, var(--kf-mix))`,
                        color: st.color,
                      }}
                    >
                      {st.label}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-[var(--kf-ink-2)]">
                    {vh.driver} · {vh.zone}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[rgba(255,255,255,0.09)]">
                      <span
                        className="block h-full rounded-full transition-all"
                        style={{ width: `${vh.progress}%`, background: color }}
                      />
                    </span>
                    <span className="font-mono text-[10px] text-[var(--kf-ink-3)]">
                      {vh.stopsCompleted}/{vh.stopsTotal} stops
                    </span>
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-semibold tabular-nums text-[var(--kf-ink)]">
                    {vh.distanceKm} km
                  </span>
                  <span className="block text-[10.5px] text-[var(--kf-ink-3)]">
                    {vh.loadKg} kg
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[1200] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="kf-card max-h-[86vh] w-full max-w-2xl overflow-y-auto">
            <VehicleDetail vehicle={open} onClose={() => setOpenId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function VehicleDetail({
  vehicle: vh,
  onClose,
}: {
  vehicle: Vehicle;
  onClose: () => void;
}) {
  const left = Math.max(0, vh.deliveriesTotal - vh.deliveriesDone);
  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-[var(--kf-ink)]">
            {vh.plate} · {vh.zone}
          </h3>
          <p className="mt-0.5 text-[11.5px] text-[var(--kf-ink-2)]">
            {vh.driver} · receiving window {vh.windowStart}-{vh.windowEnd}
          </p>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--kf-card)] text-[var(--kf-ink-2)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          icon={<Package className="h-3.5 w-3.5" />}
          label="Deliveries"
          value={`${vh.deliveriesDone} of ${vh.deliveriesTotal}`}
          sub={`${left} remaining`}
        />
        <Tile
          icon={<Leaf className="h-3.5 w-3.5" />}
          label="CO2 avoided"
          value={`${vh.co2SavedKg} kg`}
          sub="vs separate vans"
          color="var(--kf-pass)"
        />
        <Tile
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Time saved"
          value={`${vh.minutesSaved} min`}
          sub={`ETA ${vh.etaMinutes} min`}
        />
        <Tile
          icon={<Gauge className="h-3.5 w-3.5" />}
          label="Cost avoided"
          value={`AED ${vh.costSavedAed}`}
          sub={`${vh.kmSaved} km removed`}
        />
      </div>

      <div className="rounded-2xl bg-[var(--kf-card)] p-4">
        <div className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--kf-ink-3)]">
          <MapPin className="h-3 w-3" />
          Route to cover
        </div>
        <ol className="space-y-1.5">
          {vh.shipmentRefs.map((ref, i) => {
            const doneStop = i < vh.stopsCompleted;
            return (
              <li key={ref} className="flex items-center gap-2.5">
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white"
                  style={{
                    background: doneStop
                      ? "var(--kf-pass)"
                      : "rgba(255,255,255,0.22)",
                  }}
                >
                  {doneStop ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                </span>
                <span
                  className="font-mono text-[11.5px]"
                  style={{
                    color: doneStop ? "var(--kf-ink-3)" : "var(--kf-ink)",
                    textDecoration: doneStop ? "line-through" : "none",
                  }}
                >
                  Collect {ref}
                </span>
              </li>
            );
          })}
          <li className="flex items-center gap-2.5">
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[9px] font-bold text-white"
              style={{
                background:
                  vh.stopsCompleted >= vh.stopsTotal
                    ? "var(--kf-pass)"
                    : "var(--kf-accent)",
              }}
            >
              {vh.stopsCompleted >= vh.stopsTotal ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                vh.shipmentRefs.length + 1
              )}
            </span>
            <span className="text-[11.5px] font-semibold text-[var(--kf-ink)]">
              Deliver to {vh.zone}
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  color,
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-[var(--kf-card-sub)] px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-[0.08em] text-[var(--kf-ink-3)]">
        {label}
      </div>
      <div
        className="mt-1 text-[15px] font-semibold leading-none tabular-nums"
        style={{ color: color ?? "var(--kf-ink)" }}
      >
        {value}
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--kf-card)] px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--kf-ink-3)]">
        {icon}
        {label}
      </div>
      <div
        className="mt-1.5 text-[17px] font-semibold leading-none tabular-nums"
        style={{ color: color ?? "var(--kf-ink)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[10px] text-[var(--kf-ink-3)]">{sub}</div>
      )}
    </div>
  );
}
