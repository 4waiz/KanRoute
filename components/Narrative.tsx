"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, ShieldQuestion } from "lucide-react";

/**
 * The single sentence a judge should read first: what did KanForge actually
 * find? Everything else on the page is supporting detail.
 */
export function Headline({
  total,
  executable,
  pass,
  fail,
  review,
  settledExecutable,
  topFail,
  onOpenFail,
  analysisStatus,
}: {
  total: number;
  executable: number;
  pass: number;
  fail: number;
  review: number;
  settledExecutable: number;
  topFail?: { claim: string; expected?: string; observed?: string; session?: string };
  onOpenFail?: () => void;
  analysisStatus?: string;
}) {
  if (total === 0) {
    return (
      <Band tone="neutral">
        <span className="text-[var(--kf-text-dim)]">
          {analysisStatus === "error"
            ? "Analysis could not complete."
            : "Reading the target's documentation and extracting technical claims…"}
        </span>
      </Band>
    );
  }

  if (fail > 0 && topFail) {
    return (
      <Band tone="fail">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <AlertTriangle
            className="mt-0.5 h-[18px] w-[18px] shrink-0"
            style={{ color: "var(--kf-fail)" }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium text-white">
              {fail === 1
                ? "1 published claim is contradicted by the code."
                : `${fail} published claims are contradicted by the code.`}
            </div>
            <div className="mt-1 text-[13px] leading-relaxed text-[var(--kf-text-dim)]">
              “{topFail.claim}”
            </div>
            {topFail.expected && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
                <Chip label="Documented" value={topFail.expected} />
                <Chip
                  label="Actually observed"
                  value={topFail.observed ?? "—"}
                  color="var(--kf-fail)"
                />
                {topFail.session && (
                  <span className="font-mono text-[11px] text-[var(--kf-text-faint)]">
                    proven by Devin session {topFail.session.slice(0, 10)}
                  </span>
                )}
              </div>
            )}
          </div>
          {onOpenFail && (
            <button
              onClick={onOpenFail}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium text-black"
              style={{ background: "var(--kf-accent)" }}
            >
              See the proof
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </Band>
    );
  }

  if (settledExecutable < executable) {
    return (
      <Band tone="neutral">
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-medium text-white">
            {executable} of {total} claims can be proven by running the code.
          </span>
          <span className="text-[13px] text-[var(--kf-text-dim)]">
            Run Verify to have Devin inspect the repository and test one.
          </span>
        </div>
      </Band>
    );
  }

  return (
    <Band tone="pass">
      <div className="flex items-center gap-3">
        <CheckCircle2
          className="h-[18px] w-[18px] shrink-0"
          style={{ color: "var(--kf-pass)" }}
        />
        <span className="text-[15px] font-medium text-white">
          All {pass} testable claims held up under execution.
        </span>
        {review > 0 && (
          <span className="text-[13px] text-[var(--kf-text-dim)]">
            {review} more need human evidence — code cannot settle them.
          </span>
        )}
      </div>
    </Band>
  );
}

function Chip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-md border border-[var(--kf-border)] bg-black/40 px-2 py-1">
      <span className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--kf-text-faint)]">
        {label}
      </span>
      <span
        className="font-mono text-[12px] font-medium"
        style={{ color: color ?? "#fff" }}
      >
        {value}
      </span>
    </span>
  );
}

function Band({
  tone,
  children,
}: {
  tone: "fail" | "pass" | "neutral";
  children: React.ReactNode;
}) {
  const border =
    tone === "fail"
      ? "var(--kf-fail)"
      : tone === "pass"
        ? "var(--kf-pass)"
        : "var(--kf-border-strong)";
  return (
    <div
      className="kf-enter rounded-xl border px-4 py-3.5"
      style={{
        borderColor: `color-mix(in srgb, ${border} 40%, transparent)`,
        background: `color-mix(in srgb, ${border} 7%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Makes the four-stage pipeline legible at a glance, with real counts so the
 * partner contribution is visible rather than asserted.
 */
export function PipelineStrip({
  pages,
  claims,
  sessions,
  evidenceCount,
}: {
  pages: number;
  claims: number;
  sessions: number;
  evidenceCount: number;
}) {
  const stages = [
    {
      provider: "CONTEXT.DEV",
      color: "#7dd3fc",
      title: "Read the docs",
      value: `${claims} claims`,
      sub: pages > 0 ? `from ${pages} page${pages === 1 ? "" : "s"}` : "crawling…",
    },
    {
      provider: "CONVEX",
      color: "#f7b955",
      title: "Stored & live",
      value: `${claims} records`,
      sub: "realtime, no refresh",
    },
    {
      provider: "DEVIN",
      color: "#c4b5fd",
      title: "Tested the code",
      value: `${sessions} session${sessions === 1 ? "" : "s"}`,
      sub: sessions > 0 ? "repo cloned & tested" : "not started",
    },
    {
      provider: "EVIDENCE",
      color: "var(--kf-accent)",
      title: "Proof returned",
      value: `${evidenceCount} verdict${evidenceCount === 1 ? "" : "s"}`,
      sub: "commands, files, tests",
    },
  ];

  return (
    <div className="kf-panel rounded-xl px-4 py-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 lg:grid-cols-4">
        {stages.map((s, i) => (
          <div key={s.provider} className="relative flex items-start gap-2.5">
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <div className="min-w-0">
              <div
                className="font-mono text-[9.5px] font-semibold tracking-[0.1em]"
                style={{ color: s.color }}
              >
                {s.provider}
              </div>
              <div className="mt-1 text-[13px] font-medium text-white">
                {s.title}
              </div>
              <div className="mt-0.5 text-[12px] tabular-nums text-[var(--kf-text-dim)]">
                {s.value}
              </div>
              <div className="text-[11px] text-[var(--kf-text-faint)]">{s.sub}</div>
            </div>
            {i < stages.length - 1 && (
              <ArrowRight className="absolute -right-2 top-3 hidden h-3 w-3 text-[var(--kf-text-faint)] lg:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Plain-English gloss on the verifiability class. */
export function VerifiabilityNote({ verifiability }: { verifiability: string }) {
  if (verifiability === "executable") {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--kf-running)]">
        Devin can test this
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[var(--kf-review)]">
      <ShieldQuestion className="h-3 w-3" />
      Code can&apos;t prove this
    </span>
  );
}
