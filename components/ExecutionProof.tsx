"use client";

import { Terminal } from "lucide-react";

type EvidenceItem = { type: string; title: string; details: string };

/**
 * The strongest thing KanForge can show a sceptic: the actual command an agent
 * ran and the output it observed. Kept dark on the light dashboard, matching
 * the reference design's use of black callouts for the load-bearing detail.
 */
export function ExecutionProof({
  commands,
  items,
  expected,
  observed,
  verdict,
}: {
  commands: string[];
  items: EvidenceItem[];
  expected?: string;
  observed?: string;
  verdict?: string;
}) {
  const run = items.find(
    (i) => i.type === "test_run" || i.type === "test" || i.type === "command",
  );
  // The last command is the one that executed the test; earlier ones are setup.
  const runCommand = commands.length > 0 ? commands[commands.length - 1] : null;

  if (!run && !runCommand) return null;

  const failed = verdict === "FAIL";

  return (
    <div className="overflow-hidden rounded-2xl bg-[var(--kf-ink)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <Terminal className="h-3.5 w-3.5 text-white/45" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Executed by Devin
        </span>
        <span className="ml-auto flex gap-1.5">
          <Dot color="#ff5f57" />
          <Dot color="#febc2e" />
          <Dot color="#28c840" />
        </span>
      </div>

      <div className="px-4 py-3.5 font-mono text-[11px] leading-relaxed">
        {runCommand && (
          <div className="flex gap-2">
            <span className="shrink-0 select-none text-[#35c46b]">$</span>
            <span className="break-all text-white/90">{runCommand}</span>
          </div>
        )}

        {run && (
          <pre className="mt-2.5 max-h-56 overflow-auto whitespace-pre-wrap break-words text-white/55">
            {run.details}
          </pre>
        )}

        {expected && observed && (
          <div className="mt-3.5 border-t border-white/10 pt-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-white/40">documented:</span>
              <span className="text-white/90">{expected}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-white/40">observed:</span>
              <span style={{ color: failed ? "#ff6b60" : "#4fd98a" }}>
                {observed}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="h-2.5 w-2.5 rounded-full opacity-70"
      style={{ background: color }}
    />
  );
}
