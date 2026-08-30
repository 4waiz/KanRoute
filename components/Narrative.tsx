"use client";

import { ArrowRight, CheckCircle2, ShieldQuestion, Terminal } from "lucide-react";

/**
 * The single sentence a judge should read first: what did KanForge actually
 * find? Rendered as a dark pill because that is the reference design's device
 * for "this is the number that matters".
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
  topFail?: {
    claim: string;
    expected?: string;
    observed?: string;
    session?: string;
  };
  onOpenFail?: () => void;
  analysisStatus?: string;
}) {
  if (total === 0) {
    return (
      <div className="kf-card px-5 py-4">
        <span className="text-[14px] text-[var(--kf-ink-2)]">
          {analysisStatus === "error"
            ? "Analysis could not complete."
            : "Reading the target's documentation and extracting technical claims..."}
        </span>
      </div>
    );
  }

  if (fail > 0 && topFail) {
    return (
      <div className="kf-pill-dark kf-enter px-5 py-4">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold tracking-tight text-white">
              {fail === 1
                ? "1 published claim is contradicted by the code."
                : `${fail} published claims are contradicted by the code.`}
            </div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-white/60">
              {topFail.claim}
            </div>

            {topFail.expected && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <DarkChip label="Documented" value={topFail.expected} />
                <DarkChip
                  label="Observed"
                  value={topFail.observed ?? "n/a"}
                  color="var(--kf-fail)"
                />
                {topFail.session && (
                  <span className="font-mono text-[11px] text-white/40">
                    Devin {topFail.session.slice(0, 10)}
                  </span>
                )}
              </div>
            )}
          </div>

          {onOpenFail && (
            <button
              onClick={onOpenFail}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[12.5px] font-semibold text-[var(--kf-ink)]"
              style={{ background: "#fff" }}
            >
              See the proof
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (settledExecutable < executable) {
    return (
      <div className="kf-card flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4">
        <span className="text-[15px] font-semibold tracking-tight text-[var(--kf-ink)]">
          {executable} of {total} claims can be proven by running the code.
        </span>
        <span className="text-[13px] text-[var(--kf-ink-3)]">
          Run Verify to have Devin inspect the repository and test one.
        </span>
      </div>
    );
  }

  return (
    <div className="kf-card flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4">
      <CheckCircle2
        className="h-[18px] w-[18px] shrink-0"
        style={{ color: "var(--kf-pass)" }}
      />
      <span className="text-[15px] font-semibold tracking-tight text-[var(--kf-ink)]">
        All {pass} testable claims held up under execution.
      </span>
      {review > 0 && (
        <span className="text-[13px] text-[var(--kf-ink-3)]">
          {review} more need human evidence.
        </span>
      )}
    </div>
  );
}

function DarkChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-2 rounded-full bg-white/10 px-3 py-1.5">
      <span className="text-[9.5px] uppercase tracking-[0.12em] text-white/45">
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

/**
 * Four-stage pipeline with real counts, so the partner contribution is visible
 * rather than asserted.
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
      color: "#2b8fd6",
      title: "Read the docs",
      value: `${claims} claims`,
      sub: pages > 0 ? `from ${pages} page${pages === 1 ? "" : "s"}` : "crawling...",
    },
    {
      provider: "CONVEX",
      color: "#d98324",
      title: "Stored and live",
      value: `${claims} records`,
      sub: "realtime, no refresh",
    },
    {
      provider: "DEVIN",
      color: "#7c5cd6",
      title: "Tested the code",
      value: `${sessions} session${sessions === 1 ? "" : "s"}`,
      sub: sessions > 0 ? "repo cloned and tested" : "not started",
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
    <div className="kf-card px-5 py-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
        {stages.map((s, i) => (
          <div key={s.provider} className="relative flex items-start gap-2.5">
            <span
              className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <div className="min-w-0">
              <div
                className="font-mono text-[9.5px] font-semibold tracking-[0.1em]"
                style={{ color: s.color }}
              >
                {s.provider}
              </div>
              <div className="mt-1 text-[13.5px] font-semibold tracking-tight text-[var(--kf-ink)]">
                {s.title}
              </div>
              <div className="mt-0.5 text-[12.5px] tabular-nums text-[var(--kf-ink-2)]">
                {s.value}
              </div>
              <div className="text-[11px] text-[var(--kf-ink-3)]">{s.sub}</div>
            </div>
            {i < stages.length - 1 && (
              <ArrowRight className="absolute -right-2.5 top-3 hidden h-3 w-3 text-[var(--kf-ink-3)] lg:block" />
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
      <span
        className="inline-flex items-center gap-1"
        style={{ color: "var(--kf-running)" }}
      >
        <Terminal className="h-3 w-3" />
        Devin can test this
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{ color: "var(--kf-review)" }}
    >
      <ShieldQuestion className="h-3 w-3" />
      Code cannot prove this
    </span>
  );
}
