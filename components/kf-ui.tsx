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
  return "var(--kf-text-faint)";
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
  const cls = "shrink-0";
  const style = { color, width: size, height: size };

  if (status === "pass" || verdict === "PASS")
    return <CheckCircle2 className={cls} style={style} />;
  if (status === "fail" || verdict === "FAIL")
    return <XCircle className={cls} style={style} />;
  if (status === "human_review" || verdict === "HUMAN_REVIEW")
    return <ShieldQuestion className={cls} style={style} />;
  if (status === "error" || verdict === "ERROR")
    return <AlertTriangle className={cls} style={style} />;
  if (RUNNING_STATUSES.includes(status))
    return <Loader2 className={`${cls} animate-spin`} style={style} />;
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
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <StatusGlyph status={status} verdict={verdict} size={12} />
      {statusLabel(label)}
    </span>
  );
}

export function MetricTile({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="kf-panel flex flex-col justify-center rounded-xl px-4 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--kf-text-faint)]">
        {label}
      </div>
      <div
        className="mt-1 text-[27px] font-semibold leading-none tabular-nums"
        style={{ color: accent ?? "#fff" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1.5 text-[11px] text-[var(--kf-text-faint)]">{sub}</div>
      )}
    </div>
  );
}

/** Large verification ring - the single glanceable "how proven is this" number. */
export function VerificationRing({
  proven,
  total,
  size = 108,
}: {
  proven: number;
  total: number;
  size?: number;
}) {
  const pct = total > 0 ? proven / total : 0;
  const stroke = 9;
  const r = (size - stroke) / 2 - 6;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * pct;

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--kf-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 700ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-[27px] font-semibold leading-none tabular-nums text-white">
          {Math.round(pct * 100)}
          <span className="text-[13px] text-[var(--kf-text-faint)]">%</span>
        </div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[var(--kf-text-faint)]">
          Verified
        </div>
        <div className="mt-0.5 text-[11px] tabular-nums text-[var(--kf-text-dim)]">
          {proven} / {total}
        </div>
      </div>
    </div>
  );
}

const PROVIDER_STYLE: Record<string, { label: string; color: string }> = {
  "context.dev": { label: "CONTEXT.DEV", color: "#7dd3fc" },
  convex: { label: "CONVEX", color: "#f7b955" },
  devin: { label: "DEVIN", color: "#c4b5fd" },
  kanforge: { label: "KANFORGE", color: "var(--kf-accent)" },
};

export function ProviderTag({ provider }: { provider: string }) {
  const s = PROVIDER_STYLE[provider] ?? {
    label: provider.toUpperCase(),
    color: "var(--kf-text-dim)",
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
