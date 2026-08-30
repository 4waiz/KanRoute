"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Globe, Loader2, Truck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { LoadShareWordmark } from "@/components/Brand";

type SupplierDoc = {
  _id: string;
  name: string;
  status: string;
  address?: string;
  receivingFrom?: string;
  receivingTo?: string;
};

export default function StartPage() {
  const router = useRouter();
  const seed = useMutation(api.suppliers.seedDemoSuppliers);
  const createRun = useMutation(api.runs.create);
  const suppliers = useQuery(api.suppliers.list, {}) as
    | SupplierDoc[]
    | undefined;

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enriched = (suppliers ?? []).filter((s) => s.status === "enriched");
  const ready = enriched.length > 0;

  async function loadSuppliers() {
    setBusy("seed");
    setError(null);
    try {
      await seed({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suppliers.");
    } finally {
      setBusy(null);
    }
  }

  async function startRun() {
    setBusy("run");
    setError(null);
    try {
      const id = await createRun({ name: "Dubai last-mile consolidation" });
      router.push(`/run/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start run.");
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen p-3 sm:p-5">
      <div className="kf-shell mx-auto flex min-h-[calc(100vh-40px)] max-w-[1200px] flex-col p-6 sm:p-9">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <LoadShareWordmark />
          <div className="flex flex-wrap items-center gap-2">
            <Chip label="Context.dev" />
            <Chip label="Convex" />
            <Chip label="Devin" />
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center py-12">
          <div className="max-w-2xl">
            <h1 className="text-[40px] font-semibold leading-[1.04] tracking-tight text-[var(--kf-ink)] sm:text-[58px]">
              Three vans to JLT.
              <br />
              <span style={{ color: "var(--kf-accent)" }}>Make it one.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--kf-ink-2)]">
              Dubai&apos;s roads carry thousands of half-empty delivery vans every
              day. LoadShare reads each supplier&apos;s real receiving hours from
              their own website, then has an autonomous engineer build and prove
              a consolidated routing plan.
            </p>
          </div>

          <div className="kf-card mt-10 max-w-2xl p-5">
            <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--kf-ink-3)]">
              <Globe className="h-3.5 w-3.5" />
              Supplier network
            </div>

            {(suppliers ?? []).length === 0 ? (
              <p className="text-[13px] text-[var(--kf-ink-2)]">
                No suppliers loaded yet. Context.dev will read each company
                website for its Dubai address and goods receiving hours.
              </p>
            ) : (
              <div className="space-y-2">
                {(suppliers ?? []).map((s) => (
                  <div
                    key={s._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--kf-card-sub)] px-3.5 py-2.5"
                  >
                    <span className="text-[13px] font-medium text-[var(--kf-ink)]">
                      {s.name}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="max-w-[260px] truncate text-[11.5px] text-[var(--kf-ink-3)]">
                        {s.address ?? "reading site..."}
                      </span>
                      <span
                        className="font-mono text-[11px] font-semibold"
                        style={{
                          color:
                            s.status === "enriched"
                              ? "var(--kf-pass)"
                              : "var(--kf-ink-3)",
                        }}
                      >
                        {s.receivingFrom ?? "--"}-{s.receivingTo ?? "--"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="mt-4 text-[13px] text-[var(--kf-fail)]">{error}</p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {(suppliers ?? []).length === 0 ? (
                <button
                  onClick={loadSuppliers}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold text-white transition disabled:opacity-60"
                  style={{ background: "var(--kf-ink)" }}
                >
                  {busy === "seed" ? (
                    <Loader2 className="h-4 w-4 kf-spin" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                  Load supplier network
                </button>
              ) : (
                <button
                  onClick={startRun}
                  disabled={busy !== null || !ready}
                  className="group inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold text-white transition disabled:opacity-50"
                  style={{ background: "var(--kf-accent)" }}
                >
                  {busy === "run" ? (
                    <Loader2 className="h-4 w-4 kf-spin" />
                  ) : (
                    <Truck className="h-4 w-4" />
                  )}
                  Consolidate today&apos;s deliveries
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </button>
              )}
              {(suppliers ?? []).length > 0 && !ready && (
                <span className="text-[12px] text-[var(--kf-ink-3)]">
                  Context.dev is still reading supplier sites
                </span>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--kf-ink-3)]">
            <span>Context.dev reads receiving hours</span>
            <span>/</span>
            <span>Convex holds live state</span>
            <span>/</span>
            <span>Devin builds and proves the plan</span>
          </div>
        </div>
      </div>
    </main>
  );
}

function Chip({ label }: { label: string }) {
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
