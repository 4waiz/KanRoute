"use client";

import { Terminal } from "lucide-react";

type EvidenceItem = { type: string; title: string; details: string };

/**
 * The strongest thing KanForge can show a sceptic: the actual command an agent
 * ran and the output it observed. Rendered as a terminal because that is what
 * it is - not a model's summary of a test, but the test.
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
  // The command that actually executed the test is the last one - earlier ones
  // are usually setup (clone, install, compile).
  const runCommand = commands.length > 0 ? commands[commands.length - 1] : null;

  if (!run && !runCommand) return null;

  const failed = verdict === "FAIL";

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--kf-border)]">
      <div className="flex items-center gap-2 border-b border-[var(--kf-border)] bg-black/50 px-3 py-2">
        <Terminal className="h-3.5 w-3.5 text-[var(--kf-text-faint)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--kf-text-dim)]">
          Executed by Devin
        </span>
        <span className="ml-auto flex gap-1">
          <Dot color="#ff5f57" />
          <Dot color="#febc2e" />
          <Dot color="#28c840" />
        </span>
      </div>

      <div className="bg-black/70 px-3 py-3 font-mono text-[11px] leading-relaxed">
        {runCommand && (
          <div className="flex gap-2">
            <span className="shrink-0 select-none text-[var(--kf-pass)]">$</span>
            <span className="break-all text-[var(--kf-text)]">{runCommand}</span>
          </div>
        )}

        {run && (
          <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-[var(--kf-text-dim)]">
            {run.details}
          </pre>
        )}

        {expected && observed && (
          <div className="mt-3 border-t border-[var(--kf-border)] pt-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[var(--kf-text-faint)]">documented:</span>
              <span className="text-[var(--kf-text)]">{expected}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-[var(--kf-text-faint)]">observed:</span>
              <span
                style={{
                  color: failed ? "var(--kf-fail)" : "var(--kf-pass)",
                }}
              >
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
      className="h-2 w-2 rounded-full opacity-60"
      style={{ background: color }}
    />
  );
}
