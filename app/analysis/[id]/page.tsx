"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import {
  Activity,
  ExternalLink,
  FileSearch,
  LayoutGrid,
  Play,
  Radio,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ExecutionProof } from "@/components/ExecutionProof";
import { KanForgeMark } from "@/components/KanForgeMark";
import { Headline, PipelineStrip, VerifiabilityNote } from "@/components/Narrative";
import {
  CardHeader,
  KpiNumber,
  LeaderRow,
  OutcomeGauge,
  RoundButton,
  StatusGlyph,
  StatusPill,
  statusColor,
} from "@/components/kf-ui";

type AnalysisDoc = {
  name: string;
  websiteUrl: string;
  repositoryUrl: string;
  status: string;
  error?: string;
  pagesAnalyzed?: number;
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

type EvidenceDoc = {
  claimId: string;
  expected?: string;
  observed?: string;
  verdict?: string;
  summary?: string;
  commands?: string[];
  filesInspected?: string[];
  testFilesCreated?: string[];
  limitations?: string[];
  raw?: string;
  items?: { type: string; title: string; details: string }[];
};

type TraceEvent = {
  _id: string;
  provider: string;
  message: string;
  timestamp: number;
};

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
  const allEvidence = useQuery(api.evidence.byAnalysis, { analysisId }) as
    | EvidenceDoc[]
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
      pending: list.filter((c) =>
        ["ready", "queued", "devin_inspecting", "devin_testing"].includes(
          c.status,
        ),
      ).length,
      settledExecutable: list.filter(
        (c) =>
          c.verifiability === "executable" &&
          ["pass", "fail"].includes(c.status),
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

  const failedClaim = useMemo(
    () => (claims ?? []).find((c) => c.status === "fail"),
    [claims],
  );
  const failEvidence = useMemo(
    () => (allEvidence ?? []).find((e) => e.claimId === failedClaim?._id),
    [allEvidence, failedClaim],
  );

  return (
    <main className="min-h-screen p-3 sm:p-5">
      <div className="kf-shell mx-auto max-w-[1560px] p-4 sm:p-6">
        {/* Header: identity, target, and the two numbers that matter */}
        <header className="mb-5 flex flex-wrap items-start justify-between gap-6 px-1">
          <div className="min-w-0">
            <h1 className="text-[38px] font-semibold leading-none tracking-tight text-[var(--kf-ink)] sm:text-[46px]">
              {analysis?.name ?? "Analysis"}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              <a
                href={analysis?.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-[var(--kf-ink-2)] hover:text-[var(--kf-ink)]"
              >
                {analysis?.websiteUrl ?? "loading..."}
                <ExternalLink className="h-3 w-3" />
              </a>
              {analysis && <StatusPill status={analysis.status} />}
            </div>
          </div>

          <div className="flex items-start gap-8">
            <KpiNumber
              value={counts.total}
              label="Technical claims"
              pill={`${counts.executable} testable`}
              pillColor="var(--kf-running)"
            />
            <KpiNumber
              value={counts.fail}
              label="Contradicted by code"
              pill={counts.fail > 0 ? "action needed" : "none"}
              pillColor={
                counts.fail > 0 ? "var(--kf-fail)" : "var(--kf-ink-3)"
              }
            />
          </div>
        </header>

        <div className="flex gap-4">
          {/* Icon rail */}
          <nav className="hidden shrink-0 flex-col items-center gap-2.5 pt-1 lg:flex">
            <Link
              href="/"
              className="grid h-11 w-11 place-items-center rounded-full bg-[var(--kf-ink)]"
              title="KanForge home"
            >
              <KanForgeMark size={20} color="#fff" />
            </Link>
            <RailIcon active title="Proof board">
              <LayoutGrid className="h-4 w-4" />
            </RailIcon>
            <RailIcon title="Claims">
              <FileSearch className="h-4 w-4" />
            </RailIcon>
            <RailIcon title="Verification">
              <ShieldCheck className="h-4 w-4" />
            </RailIcon>
            <RailIcon title="Activity">
              <Activity className="h-4 w-4" />
            </RailIcon>
            <RailIcon title="Settings">
              <Settings className="h-4 w-4" />
            </RailIcon>
          </nav>

          <div className="min-w-0 flex-1 space-y-4">
            <Headline
              total={counts.total}
              executable={counts.executable}
              pass={counts.pass}
              fail={counts.fail}
              review={counts.review}
              settledExecutable={counts.settledExecutable}
              analysisStatus={analysis?.status}
              topFail={
                failedClaim
                  ? {
                      claim: failedClaim.normalizedClaim,
                      expected: failEvidence?.expected,
                      observed: failEvidence?.observed,
                      session: jobByClaim.get(failedClaim._id)?.devinSessionId,
                    }
                  : undefined
              }
              onOpenFail={
                failedClaim ? () => setSelected(failedClaim._id) : undefined
              }
            />

            <PipelineStrip
              pages={analysis?.pagesAnalyzed ?? 0}
              claims={counts.total}
              sessions={(jobs ?? []).filter((j) => j.devinSessionId).length}
              evidenceCount={(allEvidence ?? []).length}
            />

            <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)_380px]">
              <OutcomeCard counts={counts} />

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
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function RailIcon({
  children,
  active,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  title: string;
}) {
  return (
    <span
      title={title}
      className={`grid h-11 w-11 place-items-center rounded-full transition ${
        active
          ? "bg-[var(--kf-card)] text-[var(--kf-ink)] shadow-[var(--kf-shadow-sm)]"
          : "text-[var(--kf-ink-3)] hover:bg-[var(--kf-card)]"
      }`}
    >
      {children}
    </span>
  );
}

function OutcomeCard({
  counts,
}: {
  counts: {
    total: number;
    pass: number;
    fail: number;
    review: number;
    pending: number;
  };
}) {
  return (
    <div className="kf-card">
      <CardHeader title="Verification outcome" sub="Across all extracted claims" />
      <div className="flex flex-col items-center px-5 pb-5">
        <OutcomeGauge
          size={196}
          total={counts.total}
          caption="claims analysed"
          segments={[
            { label: "Pass", value: counts.pass, color: "var(--kf-pass)" },
            { label: "Fail", value: counts.fail, color: "var(--kf-fail)" },
            { label: "Review", value: counts.review, color: "var(--kf-review)" },
            {
              label: "Pending",
              value: counts.pending,
              color: "rgba(12,18,17,0.14)",
            },
          ]}
        />
        <div className="mt-3 w-full">
          <LeaderRow color="var(--kf-pass)" label="Proven true" value={counts.pass} />
          <LeaderRow color="var(--kf-fail)" label="Contradicted" value={counts.fail} />
          <LeaderRow
            color="var(--kf-review)"
            label="Needs human evidence"
            value={counts.review}
          />
          <LeaderRow
            color="rgba(12,18,17,0.2)"
            label="Not yet run"
            value={counts.pending}
            muted={counts.pending === 0}
          />
        </div>
      </div>
    </div>
  );
}

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
    return (
      <div className="kf-card">
        <CardHeader title="Claims" />
        <div className="space-y-2 px-5 pb-5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-[var(--kf-card-sub)]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="kf-card">
        <CardHeader title="Claims" />
        <div className="grid h-64 place-items-center px-5 pb-5 text-center">
          {analysisStatus === "error" ? (
            <div className="max-w-sm">
              <div className="text-[14px] font-semibold text-[var(--kf-fail)]">
                Analysis failed
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--kf-ink-2)]">
                {analysisError ?? "Context.dev could not extract claims."}
              </p>
            </div>
          ) : (
            <div>
              <div className="relative mx-auto h-2 w-44 overflow-hidden rounded-full bg-[var(--kf-card-sub)] kf-sweep" />
              <p className="mt-4 text-[12.5px] text-[var(--kf-ink-3)]">
                Context.dev is reading the documentation
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const ordered = [...claims].sort((a, b) => {
    const rank = (c: ClaimDoc) => (c.verifiability === "executable" ? 0 : 1);
    return rank(a) - rank(b) || a.order - b.order;
  });

  return (
    <div className="kf-card overflow-hidden">
      <CardHeader
        title="Claims"
        sub="Grouped by whether code can settle them"
      />
      <div className="px-3 pb-4">
        {ordered.map((c, idx) => {
          const job = jobByClaim.get(c._id);
          const isExec = c.verifiability === "executable";
          const prev = idx > 0 ? ordered[idx - 1] : null;
          const startsGroup =
            idx === 0 ||
            (prev !== null && (prev.verifiability === "executable") !== isExec);
          const busy =
            pending === c._id ||
            ["queued", "devin_inspecting", "devin_testing"].includes(c.status);

          return (
            <Fragment key={c._id}>
              {startsGroup && (
                <div className="flex flex-wrap items-baseline gap-x-2 px-2 pb-1.5 pt-3">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{
                      color: isExec ? "var(--kf-running)" : "var(--kf-review)",
                    }}
                  >
                    {isExec
                      ? "Provable by running the code"
                      : "Cannot be settled by code"}
                  </span>
                  <span className="text-[11px] text-[var(--kf-ink-3)]">
                    {isExec
                      ? "Devin inspects the repository and executes a test"
                      : "Needs external evidence or human judgement"}
                  </span>
                </div>
              )}

              <button
                onClick={() => onSelect(c._id)}
                className={`kf-enter mb-1.5 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                  selected === c._id
                    ? "bg-[var(--kf-card-sub)]"
                    : "hover:bg-[var(--kf-card-sub)]"
                }`}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `color-mix(in srgb, ${statusColor(c.status, c.verdict)} 13%, white)`,
                  }}
                >
                  <StatusGlyph status={c.status} verdict={c.verdict} size={16} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-[var(--kf-ink)]">
                    {c.normalizedClaim}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--kf-ink-3)]">
                    <span className="uppercase tracking-[0.08em]">
                      {c.category.replace(/_/g, " ")}
                    </span>
                    <span>·</span>
                    <VerifiabilityNote verifiability={c.verifiability} />
                    {job?.devinSessionId && (
                      <>
                        <span>·</span>
                        <span className="font-mono">
                          {job.devinSessionId.slice(0, 8)}
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
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[11.5px] font-semibold text-white"
                    style={{ background: "var(--kf-ink)" }}
                  >
                    <Play className="h-3 w-3" />
                    {busy ? "Running" : "Verify"}
                  </span>
                )}
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function TraceRail({ events }: { events: TraceEvent[] | undefined }) {
  return (
    <div className="kf-card overflow-hidden">
      <CardHeader
        title="Technology trace"
        sub="Real provider activity"
        right={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--kf-card-sub)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--kf-ink-2)]">
            <Radio className="h-3 w-3" style={{ color: "var(--kf-pass)" }} />
            Live
          </span>
        }
      />
      <div className="max-h-[560px] overflow-y-auto px-5 pb-5">
        {(events ?? []).length === 0 ? (
          <p className="text-[12.5px] text-[var(--kf-ink-3)]">
            Waiting for provider activity...
          </p>
        ) : (
          <ol>
            {(events ?? []).map((e) => (
              <li key={e._id} className="kf-enter flex gap-3 py-2">
                <span className="mt-0.5 w-[50px] shrink-0 font-mono text-[10px] tabular-nums text-[var(--kf-ink-3)]">
                  {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                    hour12: false,
                  })}
                </span>
                <span className="min-w-0 flex-1">
                  <ProviderLabel provider={e.provider} />
                  <span className="mt-0.5 block text-[12px] leading-snug text-[var(--kf-ink-2)]">
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

function ProviderLabel({ provider }: { provider: string }) {
  const map: Record<string, { label: string; color: string }> = {
    "context.dev": { label: "CONTEXT.DEV", color: "#2b8fd6" },
    convex: { label: "CONVEX", color: "#d98324" },
    devin: { label: "DEVIN", color: "#7c5cd6" },
    kanforge: { label: "KANFORGE", color: "var(--kf-accent)" },
  };
  const s = map[provider] ?? {
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

function EvidencePanel({
  claimId,
  onClose,
  job,
}: {
  claimId: Id<"claims">;
  onClose: () => void;
  job?: JobDoc;
}) {
  const claim = useQuery(api.claims.get, { claimId }) as ClaimDoc | undefined;
  const evidenceList = useQuery(api.evidence.byClaim, { claimId }) as
    | EvidenceDoc[]
    | undefined;
  const [showRaw, setShowRaw] = useState(false);

  const evidence = evidenceList?.[0];

  return (
    <div className="kf-card overflow-hidden">
      <CardHeader
        title="Evidence"
        sub="What was actually observed"
        right={
          <RoundButton onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </RoundButton>
        }
      />

      <div className="max-h-[560px] space-y-5 overflow-y-auto px-5 pb-5">
        {claim && (
          <>
            <div>
              <p className="text-[13.5px] font-medium leading-relaxed text-[var(--kf-ink)]">
                {claim.normalizedClaim}
              </p>
              <div className="mt-2.5">
                <StatusPill status={claim.status} verdict={claim.verdict} />
              </div>
            </div>

            {evidence?.expected && (
              <div className="grid grid-cols-2 gap-2">
                <Compare label="Documented" value={evidence.expected} />
                <Compare
                  label="Observed"
                  value={evidence.observed ?? "n/a"}
                  color={
                    evidence.verdict === "FAIL"
                      ? "var(--kf-fail)"
                      : "var(--kf-pass)"
                  }
                />
              </div>
            )}

            {evidence && (evidence.commands?.length ?? 0) > 0 && (
              <ExecutionProof
                commands={evidence.commands ?? []}
                items={evidence.items ?? []}
                expected={evidence.expected}
                observed={evidence.observed}
                verdict={evidence.verdict}
              />
            )}

            {evidence?.summary && (
              <Section label="Summary">
                <p className="text-[12.5px] leading-relaxed text-[var(--kf-ink-2)]">
                  {evidence.summary}
                </p>
              </Section>
            )}

            <Section label="Source">
              <a
                href={claim.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="block break-all font-mono text-[11px] text-[var(--kf-running)] hover:underline"
              >
                {claim.sourceUrl}
              </a>
              {claim.sourceExcerpt && (
                <p className="mt-2 border-l-2 border-[var(--kf-border)] pl-3 text-[12px] italic leading-relaxed text-[var(--kf-ink-2)]">
                  {claim.sourceExcerpt}
                </p>
              )}
            </Section>

            {claim.verifiability !== "executable" && (
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "color-mix(in srgb, var(--kf-review) 10%, white)",
                }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--kf-review)]">
                  Human review required
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--kf-ink-2)]">
                  {claim.humanReviewReason ??
                    "This claim cannot be settled by executing the repository."}
                </p>
                {claim.suggestedEvidence && (
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--kf-ink-2)]">
                    <span className="text-[var(--kf-ink-3)]">
                      Suggested evidence:{" "}
                    </span>
                    {claim.suggestedEvidence}
                  </p>
                )}
              </div>
            )}

            {evidence && (evidence.filesInspected?.length ?? 0) > 0 && (
              <ListBlock
                label="Files inspected"
                items={evidence.filesInspected ?? []}
                mono
              />
            )}
            {evidence && (evidence.testFilesCreated?.length ?? 0) > 0 && (
              <ListBlock
                label="Tests created"
                items={evidence.testFilesCreated ?? []}
                mono
              />
            )}
            {evidence && (evidence.limitations?.length ?? 0) > 0 && (
              <ListBlock label="Limitations" items={evidence.limitations ?? []} />
            )}

            {job?.devinSessionId && (
              <Section label="Devin session">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-lg bg-[var(--kf-card-sub)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--kf-ink-2)]">
                    {job.devinSessionId}
                  </code>
                  {job.devinSessionUrl && (
                    <a
                      href={job.devinSessionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--kf-running)] hover:underline"
                    >
                      View session
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </Section>
            )}

            {evidence?.raw && (
              <div>
                <button
                  onClick={() => setShowRaw((s) => !s)}
                  className="text-[11px] font-semibold uppercase tracking-wider text-[var(--kf-ink-3)] hover:text-[var(--kf-ink)]"
                >
                  {showRaw ? "Hide" : "View"} raw result
                </button>
                {showRaw && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-[var(--kf-card-sub)] p-3 font-mono text-[10.5px] leading-relaxed text-[var(--kf-ink-2)]">
                    {evidence.raw}
                  </pre>
                )}
              </div>
            )}

            {!evidence && claim.verifiability === "executable" && (
              <p className="text-[12.5px] text-[var(--kf-ink-3)]">
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

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--kf-ink-3)]">
        {label}
      </div>
      {children}
    </div>
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
    <div className="rounded-2xl bg-[var(--kf-card-sub)] px-3.5 py-3">
      <div className="text-[9.5px] uppercase tracking-[0.14em] text-[var(--kf-ink-3)]">
        {label}
      </div>
      <div
        className="mt-1.5 font-mono text-[13px] font-medium leading-snug"
        style={{ color: color ?? "var(--kf-ink)" }}
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
    <Section label={label}>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li
            key={`${label}-${i}`}
            className={`rounded-lg bg-[var(--kf-card-sub)] px-2.5 py-1.5 text-[11.5px] leading-relaxed text-[var(--kf-ink-2)] ${
              mono ? "break-all font-mono" : ""
            }`}
          >
            {it}
          </li>
        ))}
      </ul>
    </Section>
  );
}
