"use client";

import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Play, Radio, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { KanForgeWordmark } from "@/components/KanForgeMark";
import {
  MetricTile,
  ProviderTag,
  StatusGlyph,
  StatusPill,
  VerificationRing,
  statusColor,
} from "@/components/kf-ui";

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const analysisId = params.id as Id<"analyses">;

  const analysis = useQuery(api.analyses.get, { analysisId }) as
    | AnalysisDoc
    | null
    | undefined;
  const claims = useQuery(api.claims.listByAnalysis, { analysisId }) as
    | ClaimDoc[]
    | undefined;
  const events = useQuery(api.events.listByAnalysis, {
    analysisId,
    limit: 40,
  }) as TraceEvent[] | undefined;
  const jobs = useQuery(api.jobs.byAnalysis, { analysisId }) as
    | JobDoc[]
    | undefined;

  const [selected, setSelected] = useState<Id<"claims"> | null>(null);

  const counts = useMemo(() => {
    const list = claims ?? [];
    return {
      total: list.length,
      executable: list.filter((c) => c.verifiability === "executable").length,
      pass: list.filter((c) => c.status === "pass").length,
      fail: list.filter((c) => c.status === "fail").length,
      review: list.filter((c) => c.status === "human_review").length,
      settled: list.filter((c) =>
        ["pass", "fail", "human_review"].includes(c.status),
      ).length,
    };
  }, [claims]);

  const jobByClaim = useMemo(() => {
    const map = new Map<string, JobDoc>();
    for (const j of jobs ?? []) {
      const prev = map.get(j.claimId);
      if (!prev || j.startedAt > prev.startedAt) map.set(j.claimId, j);
    }
    return map;
  }, [jobs]);

  return (
    <main className="kf-grid-bg min-h-screen">
      <div className="mx-auto max-w-[1400px] px-6 pb-16">
        <header className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-6">
            <Link href="/">
              <KanForgeWordmark compact />
            </Link>
            <div className="hidden h-8 w-px bg-[var(--kf-border)] sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="truncate text-[15px] font-medium text-white">
                  {analysis?.name ?? "Loading…"}
                </span>
                {analysis && (
                  <StatusPill status={analysis.status} />
                )}
              </div>
              {analysis && (
                <a
                  href={analysis.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-[var(--kf-text-faint)] hover:text-[var(--kf-text-dim)]"
                >
                  {analysis.websiteUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.12em] text-[var(--kf-text-faint)]">
            <Dot label="Context.dev" ok />
            <Dot label="Convex" ok />
            <Dot label="Devin" ok />
          </div>
        </header>

        {/* Overview: one glanceable number plus the counts that matter. */}
        <section className="grid gap-3 lg:grid-cols-[auto_1fr] lg:items-stretch">
          <div className="kf-panel flex items-center justify-center rounded-xl px-6 py-3">
            <VerificationRing proven={counts.settled} total={counts.total} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <MetricTile label="Technical claims" value={counts.total} />
            <MetricTile
              label="Executable"
              value={counts.executable}
              accent="var(--kf-running)"
            />
            <MetricTile label="Pass" value={counts.pass} accent="var(--kf-pass)" />
            <MetricTile label="Fail" value={counts.fail} accent="var(--kf-fail)" />
            <MetricTile
              label="Human review"
              value={counts.review}
              accent="var(--kf-review)"
            />
          </div>
        </section>

        <section className="mt-4 grid gap-3 lg:grid-cols-[1fr_400px]">
          <ClaimBoard
            claims={claims}
            jobByClaim={jobByClaim}
            selected={selected}
            onSelect={setSelected}
            analysisStatus={analysis?.status}
            analysisError={analysis?.error}
          />

          {selected ? (
            <EvidencePanel
              claimId={selected}
              onClose={() => setSelected(null)}
              job={jobByClaim.get(selected)}
            />
          ) : (
            <TraceRail events={events} />
          )}
        </section>
      </div>
    </main>
  );
}

function Dot({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: ok ? "var(--kf-pass)" : "var(--kf-fail)" }}
      />
      {label}
    </span>
  );
}

type AnalysisDoc = {
  name: string;
  websiteUrl: string;
  repositoryUrl: string;
  status: string;
  error?: string;
};

type JobDoc = {
  claimId: string;
  startedAt: number;
  devinSessionId?: string;
  devinSessionUrl?: string;
  status?: string;
};

type ClaimDoc = {
  _id: Id<"claims">;
  order: number;
  normalizedClaim: string;
  category: string;
  verifiability: string;
  status: string;
  verdict?: string;
  sourceUrl: string;
  sourceExcerpt?: string;
  humanReviewReason?: string;
  suggestedEvidence?: string;
};

function ClaimBoard({
  claims,
  jobByClaim,
  selected,
  onSelect,
  analysisStatus,
  analysisError,
}: {
  claims: ClaimDoc[] | undefined;
  jobByClaim: Map<string, JobDoc>;
  selected: Id<"claims"> | null;
  onSelect: (id: Id<"claims">) => void;
  analysisStatus?: string;
  analysisError?: string;
}) {
  const verify = useMutation(api.devin.verifyClaim);
  const [pending, setPending] = useState<string | null>(null);

  if (claims === undefined) {
    return <Shell><Skeleton /></Shell>;
  }

  if (claims.length === 0) {
    return (
      <Shell>
        <div className="grid h-64 place-items-center text-center">
          {analysisStatus === "error" ? (
            <div className="max-w-sm">
              <div className="text-[13px] font-medium text-[var(--kf-fail)]">
                Analysis failed
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--kf-text-dim)]">
                {analysisError ?? "Context.dev could not extract claims."}
              </p>
            </div>
          ) : (
            <div>
              <div className="relative mx-auto h-2 w-40 overflow-hidden rounded-full bg-white/5 kf-sweep" />
              <p className="mt-4 text-[12px] uppercase tracking-[0.14em] text-[var(--kf-text-faint)]">
                Context.dev discovering claims
              </p>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="divide-y divide-[var(--kf-border)]">
        {claims.map((c) => {
          const job = jobByClaim.get(c._id);
          const isExec = c.verifiability === "executable";
          const busy =
            pending === c._id ||
            ["queued", "devin_inspecting", "devin_testing"].includes(c.status);

          return (
            <button
              key={c._id}
              onClick={() => onSelect(c._id)}
              className={`kf-enter flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-white/[0.025] ${
                selected === c._id ? "bg-white/[0.035]" : ""
              }`}
            >
              <span className="w-5 shrink-0 font-mono text-[11px] text-[var(--kf-text-faint)]">
                {String(c.order).padStart(2, "0")}
              </span>

              <span
                className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full"
                style={{
                  background: `color-mix(in srgb, ${statusColor(c.status, c.verdict)} 14%, transparent)`,
                  color: statusColor(c.status, c.verdict),
                }}
              >
                <StatusGlyph status={c.status} verdict={c.verdict} size={14} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-[var(--kf-text)]">
                  {c.normalizedClaim}
                </span>
                <span className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.1em] text-[var(--kf-text-faint)]">
                  <span>{c.category.replace(/_/g, " ")}</span>
                  <span>·</span>
                  <span
                    style={{
                      color: isExec ? "var(--kf-running)" : "var(--kf-review)",
                    }}
                  >
                    {c.verifiability.replace(/_/g, " ")}
                  </span>
                  {job?.devinSessionId && (
                    <>
                      <span>·</span>
                      <span className="font-mono normal-case tracking-normal">
                        {job.devinSessionId.slice(0, 10)}
                      </span>
                    </>
                  )}
                </span>
              </span>

              <StatusPill status={c.status} verdict={c.verdict} />

              {isExec && !["pass", "fail"].includes(c.status) && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (busy) return;
                    setPending(c._id);
                    try {
                      await verify({ claimId: c._id });
                    } finally {
                      setPending(null);
                    }
                  }}
                  onKeyDown={() => {}}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--kf-border-strong)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--kf-text-dim)] transition hover:border-[var(--kf-accent)] hover:text-white"
                >
                  <Play className="h-3 w-3" />
                  {busy ? "Running" : "Verify"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="kf-panel overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-[var(--kf-border)] px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--kf-text-dim)]">
          Claims board
        </span>
      </div>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2 p-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.03]" />
      ))}
    </div>
  );
}

function TraceRail({ events }: { events: TraceEvent[] | undefined }) {
  return (
    <div className="kf-panel overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-[var(--kf-border)] px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--kf-text-dim)]">
          Technology trace
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--kf-text-faint)]">
          <Radio className="h-3 w-3" style={{ color: "var(--kf-pass)" }} />
          Live
        </span>
      </div>
      <div className="max-h-[560px] overflow-y-auto">
        {(events ?? []).length === 0 ? (
          <p className="p-4 text-[12px] text-[var(--kf-text-faint)]">
            Waiting for provider activity…
          </p>
        ) : (
          <ol className="p-3">
            {(events ?? []).map((e) => (
              <li key={e._id} className="kf-enter flex gap-3 px-1 py-2">
                <span className="mt-0.5 w-[52px] shrink-0 font-mono text-[10px] tabular-nums text-[var(--kf-text-faint)]">
                  {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                    hour12: false,
                  })}
                </span>
                <span className="min-w-0 flex-1">
                  <ProviderTag provider={e.provider} />
                  <span className="mt-0.5 block text-[12px] leading-snug text-[var(--kf-text-dim)]">
                    {e.message}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

type TraceEvent = {
  _id: string;
  provider: string;
  message: string;
  timestamp: number;
};

function EvidencePanel({
  claimId,
  onClose,
  job,
}: {
  claimId: Id<"claims">;
  onClose: () => void;
  job?: { devinSessionId?: string; devinSessionUrl?: string; status?: string };
}) {
  const claim = useQuery(api.claims.get, { claimId });
  const evidenceList = useQuery(api.evidence.byClaim, { claimId });
  const [showRaw, setShowRaw] = useState(false);

  const evidence = evidenceList?.[0];

  return (
    <div className="kf-panel overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-[var(--kf-border)] px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--kf-text-dim)]">
          Evidence
        </span>
        <button
          onClick={onClose}
          className="text-[var(--kf-text-faint)] transition hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[560px] space-y-5 overflow-y-auto p-4">
        {claim && (
          <>
            <div>
              <Label>Claim</Label>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-white">
                {claim.normalizedClaim}
              </p>
              <div className="mt-2">
                <StatusPill status={claim.status} verdict={claim.verdict} />
              </div>
            </div>

            {evidence?.expected && (
              <div>
                <Label>Result</Label>
                <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
                  <Compare label="Expected" value={evidence.expected} />
                  <div className="grid place-items-center text-[10px] font-semibold text-[var(--kf-text-faint)]">
                    VS
                  </div>
                  <Compare
                    label="Observed"
                    value={evidence.observed ?? "—"}
                    color={
                      evidence.verdict === "FAIL"
                        ? "var(--kf-fail)"
                        : "var(--kf-pass)"
                    }
                  />
                </div>
              </div>
            )}

            {evidence?.summary && (
              <div>
                <Label>Summary</Label>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--kf-text-dim)]">
                  {evidence.summary}
                </p>
              </div>
            )}

            <div>
              <Label>Source</Label>
              <a
                href={claim.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 block break-all font-mono text-[11px] text-[var(--kf-running)] hover:underline"
              >
                {claim.sourceUrl}
              </a>
              {claim.sourceExcerpt && (
                <p className="mt-2 border-l-2 border-[var(--kf-border-strong)] pl-3 text-[12px] italic leading-relaxed text-[var(--kf-text-dim)]">
                  {claim.sourceExcerpt}
                </p>
              )}
            </div>

            {/* Human review is a first-class outcome, not a failure. */}
            {claim.verifiability !== "executable" && (
              <div className="rounded-lg border border-[var(--kf-review)]/30 bg-[var(--kf-review)]/[0.07] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--kf-review)]">
                  Human review required
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--kf-text-dim)]">
                  {claim.humanReviewReason ??
                    "This claim cannot be settled by executing the repository."}
                </p>
                {claim.suggestedEvidence && (
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--kf-text-dim)]">
                    <span className="text-[var(--kf-text-faint)]">
                      Suggested evidence:{" "}
                    </span>
                    {claim.suggestedEvidence}
                  </p>
                )}
              </div>
            )}

            {evidence && evidence.commands.length > 0 && (
              <ListBlock label="Commands run" items={evidence.commands} mono />
            )}
            {evidence && evidence.filesInspected.length > 0 && (
              <ListBlock label="Files inspected" items={evidence.filesInspected} mono />
            )}
            {evidence && evidence.testFilesCreated.length > 0 && (
              <ListBlock label="Tests created" items={evidence.testFilesCreated} mono />
            )}
            {evidence && evidence.limitations.length > 0 && (
              <ListBlock label="Limitations" items={evidence.limitations} />
            )}

            {job?.devinSessionId && (
              <div>
                <Label>Devin session</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="rounded bg-black/50 px-2 py-1 font-mono text-[11px] text-[var(--kf-text-dim)]">
                    {job.devinSessionId}
                  </code>
                  {job.devinSessionUrl && (
                    <a
                      href={job.devinSessionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--kf-running)] hover:underline"
                    >
                      View session
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {evidence?.raw && (
              <div>
                <button
                  onClick={() => setShowRaw((s) => !s)}
                  className="text-[11px] uppercase tracking-wider text-[var(--kf-text-faint)] hover:text-white"
                >
                  {showRaw ? "Hide" : "View"} raw result
                </button>
                {showRaw && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/60 p-3 font-mono text-[10.5px] leading-relaxed text-[var(--kf-text-dim)]">
                    {evidence.raw}
                  </pre>
                )}
              </div>
            )}

            {!evidence && claim.verifiability === "executable" && (
              <p className="text-[12px] text-[var(--kf-text-faint)]">
                No evidence yet. Run Verify to have Devin inspect the repository
                and execute a test.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--kf-text-faint)]">
      {children}
    </span>
  );
}

function Compare({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--kf-border)] bg-black/30 px-3 py-2.5">
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--kf-text-faint)]">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-[14px] font-medium leading-snug"
        style={{ color: color ?? "#fff" }}
      >
        {value}
      </div>
    </div>
  );
}

function ListBlock({
  label,
  items,
  mono,
}: {
  label: string;
  items: string[];
  mono?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <ul className="mt-1.5 space-y-1">
        {items.map((it, i) => (
          <li
            key={`${label}-${i}`}
            className={`rounded bg-black/30 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-[var(--kf-text-dim)] ${
              mono ? "font-mono break-all" : ""
            }`}
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
