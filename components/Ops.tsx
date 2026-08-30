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
 * The entire argument, in one line: this many vans today, this many after
 * consolidation. An earlier version walked through three labelled stages and
 * a status word, which is more reading than a judge glancing at a screen for
 * two seconds will do. Two numbers and an arrow say it faster.
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
  const removed = Math.max(0, baselineVans - usedVans);

  return (
    <div className="kf-card flex items-center gap-4 px-4 py-2.5">
      <Side
        label="Today"
        value={`${baselineVans}`}
        unit="vans"
        sub={`${companies} companies, ${consignments} consignments`}
        icon={<Building2 className="h-4 w-4" />}
        tone="var(--kf-ink-3)"
      />

      <span className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-[var(--kf-ink-3)]">
          {optimising ? (
            <>
              <Loader2 className="h-3 w-3 kf-spin" style={{ color: "var(--kf-running)" }} />
              {detail ? `Devin ${detail}` : "Devin optimising"}
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" style={{ color: "var(--kf-accent)" }} />
              consolidated by Devin
            </>
          )}
        </span>
        <span
          className="h-px w-full"
          style={{
            background: optimising
              ? "linear-gradient(90deg, transparent, var(--kf-running), transparent)"
              : "linear-gradient(90deg, transparent, var(--kf-border-strong), transparent)",
          }}
        />
      </span>

      <Side
        label="Shared fleet"
        value={done ? `${usedVans}` : "-"}
        unit="vans"
        sub={done ? `${removed} vehicles off the road` : "waiting for a proven plan"}
        icon={<Truck className="h-4 w-4" />}
        tone={done ? "var(--kf-pass)" : "var(--kf-ink-3)"}
        strong={done}
        alignRight
      />
    </div>
  );
}

function Side({
  label,
  value,
  unit,
  sub,
  icon,
  tone,
  strong,
  alignRight,
}: {
  label: string;
  value: string;
  unit: string;
  sub: string;
  icon: React.ReactNode;
  tone: string;
  strong?: boolean;
  alignRight?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2.5 ${alignRight ? "flex-row-reverse text-right" : ""}`}
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
        style={{
          background: `color-mix(in srgb, ${tone} 15%, var(--kf-mix))`,
          color: tone,
        }}
      >
        {icon}
      </span>
      <span>
        <span className="block text-[9.5px] uppercase tracking-[0.13em] text-[var(--kf-ink-3)]">
          {label}
        </span>
        <span className="flex items-baseline gap-1" style={{ flexDirection: alignRight ? "row-reverse" : "row" }}>
          <span
            className="text-[26px] font-semibold leading-none tabular-nums"
            style={{ color: strong ? "var(--kf-pass)" : "var(--kf-ink)" }}
          >
            {value}
          </span>
          <span className="text-[11px] font-medium text-[var(--kf-ink-2)]">{unit}</span>
        </span>
        <span className="mt-0.5 block whitespace-nowrap text-[10px] text-[var(--kf-ink-3)]">
          {sub}
        </span>
      </span>
    </div>
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
