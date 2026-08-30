"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

export type Verdict = "PASS" | "FAIL" | "HUMAN_REVIEW" | "ERROR";

export const VERDICT_COLOR: Record<Verdict, string> = {
  PASS: "var(--kf-pass)",
  FAIL: "var(--kf-fail)",
  HUMAN_REVIEW: "var(--kf-review)",
  ERROR: "var(--kf-fail)",
};

const RUNNING_STATUSES = [
  "queued",
  "devin_inspecting",
  "devin_testing",
  "classifying",
  "discovering",
];

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").toUpperCase();
}

export function statusColor(status: string, verdict?: string): string {
  if (verdict && verdict in VERDICT_COLOR) {
    return VERDICT_COLOR[verdict as Verdict];
  }
  if (status === "pass") return "var(--kf-pass)";
  if (status === "fail") return "var(--kf-fail)";
  if (status === "human_review") return "var(--kf-review)";
  if (status === "error") return "var(--kf-fail)";
  if (RUNNING_STATUSES.includes(status)) return "var(--kf-running)";
  return "var(--kf-ink-3)";
}

export function StatusGlyph({
  status,
  verdict,
  size = 16,
}: {
  status: string;
  verdict?: string;
  size?: number;
}) {
  const color = statusColor(status, verdict);
  const style = { color, width: size, height: size };
  const cls = "shrink-0";

  if (status === "pass" || verdict === "PASS")
    return <CheckCircle2 className={cls} style={style} />;
  if (status === "fail" || verdict === "FAIL")
    return <XCircle className={cls} style={style} />;
  if (status === "human_review" || verdict === "HUMAN_REVIEW")
    return <ShieldQuestion className={cls} style={style} />;
  if (status === "error" || verdict === "ERROR")
    return <AlertTriangle className={cls} style={style} />;
  if (RUNNING_STATUSES.includes(status))
    return <Loader2 className={`${cls} kf-spin`} style={style} />;
  return <CircleDashed className={cls} style={style} />;
}

export function StatusPill({
  status,
  verdict,
}: {
  status: string;
  verdict?: string;
}) {
  const color = statusColor(status, verdict);
  const label = verdict && verdict !== "ERROR" ? verdict : status;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 13%, white)`,
      }}
    >
      <StatusGlyph status={status} verdict={verdict} size={12} />
      {statusLabel(label)}
    </span>
  );
}

/** Big headline number with a small pill beside it, as in the reference. */
export function KpiNumber({
  value,
  label,
  pill,
  pillColor,
}: {
  value: ReactNode;
  label: string;
  pill?: string;
  pillColor?: string;
}) {
  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-2.5">
        <span className="text-[38px] font-semibold leading-none tracking-tight tabular-nums text-[var(--kf-ink)]">
          {value}
        </span>
        {pill && (
          <span
            className="kf-chip px-2.5 py-1 text-[11px] font-medium"
            style={{ color: pillColor ?? "var(--kf-ink-2)" }}
          >
            {pill}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[12px] text-[var(--kf-ink-3)]">{label}</div>
    </div>
  );
}

type Segment = { label: string; value: number; color: string };

/**
 * Stacked arc gauge. Shows the outcome mix rather than a bare percentage,
 * because "2 pass / 1 fail / 3 review" is the interesting shape, not "100%".
 */
export function OutcomeGauge({
  segments,
  total,
  caption,
  size = 210,
}: {
  segments: Segment[];
  total: number;
  caption: string;
  size?: number;
}) {
  const stroke = 16;
  const r = size / 2 - stroke;
  const cx = size / 2;
  const cy = size / 2;

  // 270-degree arc opening at the bottom, matching the reference gauge.
  const START = 135;
  const SWEEP = 270;
  const toXY = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = toXY(from);
    const [x2, y2] = toXY(to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  let cursor = START;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size * 0.88 }}
    >
      <svg width={size} height={size} className="absolute left-0 top-0">
        <path
          d={arc(START, START + SWEEP)}
          fill="none"
          stroke="rgba(12,18,17,0.06)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {segments.map((s) => {
          if (s.value <= 0) return null;
          const span = (s.value / sum) * SWEEP;
          const d = arc(cursor + 1.4, cursor + span - 1.4);
          cursor += span;
          return (
            <path
              key={s.label}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div
        className="absolute inset-x-0 flex flex-col items-center"
        style={{ top: size * 0.32 }}
      >
        <div className="text-[40px] font-semibold leading-none tracking-tight tabular-nums text-[var(--kf-ink)]">
          {total}
        </div>
        <div className="mt-2 text-[12px] text-[var(--kf-ink-3)]">{caption}</div>
      </div>
    </div>
  );
}

/** Legend row with a dotted leader line, as in the reference chart. */
export function LeaderRow({
  color,
  label,
  value,
  muted,
}: {
  color: string;
  label: string;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center py-[7px]">
      <span
        className="mr-2.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: muted ? "rgba(12,18,17,0.16)" : color }}
      />
      <span
        className="text-[13px] font-medium"
        style={{ color: muted ? "var(--kf-ink-3)" : "var(--kf-ink)" }}
      >
        {label}
      </span>
      <span className="kf-leader" />
      <span
        className="text-[14px] font-semibold tabular-nums"
        style={{ color: muted ? "var(--kf-ink-3)" : "var(--kf-ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

const PROVIDER_STYLE: Record<string, { label: string; color: string }> = {
  "context.dev": { label: "CONTEXT.DEV", color: "#2b8fd6" },
  convex: { label: "CONVEX", color: "#d98324" },
  devin: { label: "DEVIN", color: "#7c5cd6" },
  kanforge: { label: "KANFORGE", color: "var(--kf-accent)" },
};

export function ProviderTag({ provider }: { provider: string }) {
  const s = PROVIDER_STYLE[provider] ?? {
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

/** Circular icon button used in card headers. */
export function RoundButton({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="grid h-8 w-8 place-items-center rounded-full bg-[var(--kf-card-sub)] text-[var(--kf-ink-2)] transition hover:bg-[rgba(12,18,17,0.07)]"
    >
      {children}
    </button>
  );
}

export function CardHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--kf-ink)]">
          {title}
        </h2>
        {sub && (
          <p className="mt-0.5 text-[12px] text-[var(--kf-ink-3)]">{sub}</p>
        )}
      </div>
      {right}
    </div>
  );
}
