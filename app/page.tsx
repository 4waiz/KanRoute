"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Boxes, Loader2, Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { KanForgeWordmark } from "@/components/KanForgeMark";

const DEMO_REPO = "https://github.com/4waiz/KanForge";

export default function StartPage() {
  const router = useRouter();
  const createAnalysis = useMutation(api.analyses.create);

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadDemo() {
    setWebsiteUrl(`${window.location.origin}/demo-target`);
    setRepositoryUrl(DEMO_REPO);
    setIsDemo(true);
    setError(null);
  }

  function validate(): string | null {
    try {
      const u = new URL(websiteUrl);
      if (!["http:", "https:"].includes(u.protocol)) {
        return "Website URL must be http or https.";
      }
    } catch {
      return "Enter a valid website URL.";
    }
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(repositoryUrl)) {
      return "Repository must be a public GitHub URL (https://github.com/owner/repo).";
    }
    return null;
  }

  async function analyze() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const id = await createAnalysis({
        name: isDemo ? "ForgeRelay Demo" : new URL(websiteUrl).hostname,
        websiteUrl,
        repositoryUrl,
        isDemo,
      });
      router.push(`/analysis/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start analysis.");
      setBusy(false);
    }
  }

  return (
    <main className="kf-grid-bg min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
        <header className="flex items-center justify-between py-7">
          <KanForgeWordmark />
          <div className="hidden items-center gap-4 text-[11px] uppercase tracking-wider text-[var(--kf-text-faint)] sm:flex">
            <Health label="Context.dev" />
            <Health label="Convex" />
            <Health label="Devin" />
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center pb-24">
          <div className="max-w-2xl">
            <h1 className="text-[42px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
              Technical claims,
              <br />
              <span style={{ color: "var(--kf-accent)" }}>
                forged into proof.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[var(--kf-text-dim)]">
              KanForge does not ask a model whether a claim sounds believable.
              It extracts the claim from your documentation, then runs it
              against your repository and returns the evidence.
            </p>
          </div>

          <div className="kf-panel mt-11 max-w-2xl rounded-xl p-5">
            <Field
              label="Company / product website"
              placeholder="https://example.com/docs"
              value={websiteUrl}
              onChange={(val) => {
                setWebsiteUrl(val);
                setIsDemo(false);
              }}
            />
            <div className="h-3" />
            <Field
              label="GitHub repository"
              placeholder="https://github.com/owner/repo"
              value={repositoryUrl}
              onChange={setRepositoryUrl}
            />

            {error && (
              <p className="mt-4 text-[13px] text-[var(--kf-fail)]">{error}</p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={analyze}
                disabled={busy}
                className="group inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium text-black transition disabled:opacity-60"
                style={{ background: "var(--kf-accent)" }}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Analyze claims
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={loadDemo}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--kf-border-strong)] px-4 py-2.5 text-[13px] font-medium text-[var(--kf-text-dim)] transition hover:text-white disabled:opacity-60"
              >
                <Boxes className="h-4 w-4" />
                Load demo target
              </button>

              {isDemo && (
                <span className="text-[11px] uppercase tracking-wider text-[var(--kf-review)]">
                  Synthetic target loaded
                </span>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-[var(--kf-text-faint)]">
            <span>Context.dev extracts</span>
            <span>/</span>
            <span>Convex orchestrates</span>
            <span>/</span>
            <span>Devin proves</span>
            <span>/</span>
            <span style={{ color: "var(--kf-accent)" }}>Evidence</span>
          </div>
        </div>
      </div>
    </main>
  );
}

function Health({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--kf-pass)" }}
      />
      {label}
    </span>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-[var(--kf-text-faint)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="w-full rounded-lg border border-[var(--kf-border)] bg-black/40 px-3.5 py-2.5 font-mono text-[13px] text-white outline-none transition placeholder:text-[var(--kf-text-faint)] focus:border-[var(--kf-accent)]"
      />
    </label>
  );
}
