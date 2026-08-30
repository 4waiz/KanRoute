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
    <main className="min-h-screen p-3 sm:p-5">
      <div className="kf-shell mx-auto flex min-h-[calc(100vh-40px)] max-w-[1200px] flex-col p-6 sm:p-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <KanForgeWordmark />
          <div className="flex items-center gap-2">
            <Health label="Context.dev" />
            <Health label="Convex" />
            <Health label="Devin" />
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center py-12">
          <div className="max-w-2xl">
            <h1 className="text-[42px] font-semibold leading-[1.04] tracking-tight text-[var(--kf-ink)] sm:text-[60px]">
              Technical claims,
              <br />
              <span style={{ color: "var(--kf-accent)" }}>
                forged into proof.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[var(--kf-ink-2)]">
              KanForge does not ask a model whether a claim sounds believable.
              It extracts the claim from your documentation, then runs it
              against your repository and returns the evidence.
            </p>
          </div>

          <div className="kf-card mt-10 max-w-2xl p-5">
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
                className="group inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold text-white transition disabled:opacity-60"
                style={{ background: "var(--kf-ink)" }}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 kf-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Analyze claims
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </button>

              <button
                onClick={loadDemo}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--kf-card-sub)] px-5 py-3 text-[13px] font-semibold text-[var(--kf-ink-2)] transition hover:text-[var(--kf-ink)] disabled:opacity-60"
              >
                <Boxes className="h-4 w-4" />
                Load demo target
              </button>

              {isDemo && (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--kf-review)]">
                  Synthetic target loaded
                </span>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--kf-ink-3)]">
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
    <span className="kf-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[var(--kf-ink-2)]">
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
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--kf-ink-3)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="w-full rounded-xl bg-[var(--kf-card-sub)] px-4 py-3 font-mono text-[13px] text-[var(--kf-ink)] outline-none transition placeholder:text-[var(--kf-ink-3)] focus:ring-2 focus:ring-[var(--kf-accent)]"
      />
    </label>
  );
}
