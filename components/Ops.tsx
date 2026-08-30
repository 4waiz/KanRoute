"use client";

import {
  AlertTriangle,
  Building2,
  Check,
  CircleDot,
  Loader2,
  Radio,
  Sparkles,
  Truck,
} from "lucide-react";

/**
 * Before -> Optimising -> After. The staged view is the whole argument:
 * the same parcels, a third of the vans.
 */
export function ConsolidationFlow({
  status,
  baselineVans,
  usedVans,
  companies,
  consignments,
  detail,
}: {
  status?: string;
  baselineVans: number;
  usedVans: number;
  companies: number;
  consignments: number;
  detail?: string;
}) {
  const optimising =
    status === "planning" || status === "devin_optimising" || status === "enriching";
  const done = status === "completed";

  return (
    <div className="kf-card flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
      <Stage
        state={done || optimising ? "done" : "current"}
        title="Today"
        value={`${baselineVans} vans`}
        sub={`${companies} companies booking separately`}
        icon={<Building2 className="h-3.5 w-3.5" />}
      />

      <Arrow active={optimising} />

      <Stage
        state={optimising ? "current" : done ? "done" : "idle"}
        title="KanRoute"
        value={optimising ? "Optimising" : "Planned"}
        sub={
          optimising
            ? (detail ?? "Devin is writing and running the optimiser")
            : `${consignments} consignments pooled`
        }
        icon={
          optimising ? (
            <Loader2 className="h-3.5 w-3.5 kf-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )
        }
      />

      <Arrow active={done} />

      <Stage
        state={done ? "done" : "idle"}
        title="Shared fleet"
        value={done ? `${usedVans} vans` : "-"}
        sub={
          done
            ? `${Math.max(0, baselineVans - usedVans)} vehicles off the road`
            : "waiting for a proven plan"
        }
        icon={<Truck className="h-3.5 w-3.5" />}
        highlight={done}
      />
    </div>
  );
}

function Stage({
  state,
  title,
  value,
  sub,
  icon,
  highlight,
}: {
  state: "idle" | "current" | "done";
  title: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  const color =
    state === "current"
      ? "var(--kf-running)"
      : state === "done"
        ? highlight
          ? "var(--kf-pass)"
          : "var(--kf-ink-2)"
        : "var(--kf-ink-3)";
  return (
    <div className="flex min-w-[140px] items-start gap-2.5">
      <span
        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
        style={{
          background: `color-mix(in srgb, ${color} 15%, var(--kf-mix))`,
          color,
        }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[9.5px] uppercase tracking-[0.12em] text-[var(--kf-ink-3)]">
          {title}
        </span>
        <span
          className="block text-[17px] font-semibold leading-tight tabular-nums"
          style={{ color: state === "idle" ? "var(--kf-ink-3)" : "var(--kf-ink)" }}
        >
          {value}
        </span>
        <span className="block truncate text-[10px] text-[var(--kf-ink-3)]">
          {sub}
        </span>
      </span>
    </div>
  );
}

function Arrow({ active }: { active?: boolean }) {
  return (
    <span className="hidden flex-1 items-center sm:flex" aria-hidden="true">
      <span
        className="h-px w-full"
        style={{
          background: active
            ? "linear-gradient(90deg, transparent, var(--kf-running), transparent)"
            : "var(--kf-border)",
        }}
      />
    </span>
  );
}

/** The agent's own reasoning, plan-level and per route. */
export function WhyPanel({
  strategy,
  routeLabel,
  routeZone,
  rationale,
  companies,
}: {
  strategy?: string;
  routeLabel?: string;
  routeZone?: string;
  rationale?: string;
  companies?: string[];
}) {
  return (
    <div className="kf-card flex min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between px-3 pb-1.5 pt-2.5">
        <h2 className="text-[12px] font-semibold tracking-tight text-[var(--kf-ink)]">
          Why this plan
        </h2>
        <span className="text-[9.5px] text-[var(--kf-ink-3)]">
          {routeLabel ? routeLabel : "agent reasoning"}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {rationale ? (
          <>
            <div className="mb-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[11px] font-semibold text-[var(--kf-ink)]">
                {routeZone}
              </span>
              {(companies ?? []).map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-[var(--kf-card-sub)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--kf-ink-2)]"
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--kf-ink-2)]">
              {rationale}
            </p>
          </>
        ) : strategy ? (
          <p className="text-[11px] leading-relaxed text-[var(--kf-ink-2)]">
            {strategy}
          </p>
        ) : (
          <p className="text-[11px] text-[var(--kf-ink-3)]">
            Run a consolidation and the agent explains what it optimised for and
            why each vehicle carries what it does.
          </p>
        )}
      </div>
    </div>
  );
}

/** Break the plan on purpose, and make the agent solve it again. */
export function DisruptionPanel({
  scenarios,
  onTrigger,
  busy,
  activeDisruption,
}: {
  scenarios: { id: string; label: string; detail: string }[];
  onTrigger: (id: string) => void;
  busy: boolean;
  activeDisruption?: string;
}) {
  return (
    <div className="kf-card flex min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between px-3 pb-1.5 pt-2.5">
        <h2 className="text-[12px] font-semibold tracking-tight text-[var(--kf-ink)]">
          Simulate disruption
        </h2>
        <AlertTriangle
          className="h-3.5 w-3.5"
          style={{ color: "var(--kf-review)" }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {activeDisruption && (
          <p
            className="mb-1.5 rounded-lg px-2 py-1.5 text-[10px] leading-snug"
            style={{
              background: "color-mix(in srgb, var(--kf-review) 12%, var(--kf-mix))",
              color: "var(--kf-review)",
            }}
          >
            Replanned under: {activeDisruption}
          </p>
        )}
        <div className="grid gap-1">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => onTrigger(s.id)}
              disabled={busy}
              className="rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--kf-card-sub)] disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--kf-ink)]">
                <CircleDot
                  className="h-3 w-3 shrink-0"
                  style={{ color: "var(--kf-review)" }}
                />
                {s.label}
              </span>
              <span className="mt-0.5 block truncate text-[9.5px] text-[var(--kf-ink-3)]">
                {s.detail}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Makes Convex reactivity visible: this counter only moves because the
 * server pushed a new value, never because the client polled.
 */
export function LiveState({
  events,
}: {
  events: { _id: string; provider: string; message: string; timestamp: number }[];
}) {
  const newest = events[0];

  return (
    <div className="kf-card flex min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between px-3 pb-1.5 pt-2.5">
        <h2 className="text-[12px] font-semibold tracking-tight text-[var(--kf-ink)]">
          Live state
        </h2>
        {/* Remounts whenever a new event arrives, replaying the flash. */}
        <span
          key={newest?._id ?? "idle"}
          className="kr-ping inline-flex items-center gap-1 rounded-full bg-[var(--kf-card-sub)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--kf-ink-3)]"
        >
          <Radio className="h-2.5 w-2.5" />
          convex
        </span>
      </div>
      <div className="shrink-0 px-3 pb-1.5">
        <span className="text-[10px] text-[var(--kf-ink-3)]">
          {events.length} events pushed · no client polling
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-2.5">
        <ol>
          {events.slice(0, 14).map((e, i) => (
            <li key={e._id} className="kf-enter flex gap-2 py-[3px]">
              <span className="w-[42px] shrink-0 font-mono text-[9px] tabular-nums text-[var(--kf-ink-3)]">
                {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                  hour12: false,
                })}
              </span>
              <span
                className="w-[52px] shrink-0 font-mono text-[8.5px] font-semibold tracking-[0.06em]"
                style={{ color: providerColor(e.provider) }}
              >
                {providerLabel(e.provider)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--kf-ink-2)]">
                {e.message}
              </span>
              {i === 0 && (
                <Check
                  className="h-3 w-3 shrink-0"
                  style={{ color: "var(--kf-pass)" }}
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function providerLabel(p: string) {
  if (p === "context.dev") return "CONTEXT";
  if (p === "convex") return "CONVEX";
  if (p === "devin") return "DEVIN";
  return "FLEET";
}

function providerColor(p: string) {
  if (p === "context.dev") return "#5fb2ff";
  if (p === "convex") return "#ffbb3d";
  if (p === "devin") return "#a78bfa";
  return "var(--kf-accent)";
}
