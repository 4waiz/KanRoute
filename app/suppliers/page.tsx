"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { CheckCircle2, ExternalLink, Globe, Loader2, Plus, XCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Panel } from "@/components/Shell";
import { useConsole } from "@/components/useConsole";

export default function SuppliersView() {
  const { suppliers, events } = useConsole();
  const addSupplier = useMutation(api.suppliers.addSupplier);

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = suppliers ?? [];
  const mapped = list.filter((s) => s.status === "enriched" && s.lat != null);
  const contextEvents = (events ?? []).filter((e) => e.provider === "context.dev");

  async function add() {
    if (!name.trim()) {
      setError("Give the supplier a name.");
      return;
    }
    let url = website.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      new URL(url);
    } catch {
      setError("Enter a valid website.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await addSupplier({ name: name.trim(), website: url });
      setName("");
      setWebsite("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add supplier.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-0 gap-2.5 lg:h-full lg:grid-cols-[minmax(0,1fr)_330px]">
      <Panel
        title="Supplier network"
        sub={`${mapped.length} of ${list.length} usable for routing`}
        right={
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--kf-card-sub)] px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#4d9dff]">
            <Globe className="h-3 w-3" />
            Context.dev
          </span>
        }
        bodyClassName="px-2.5 pb-2.5"
      >
        <div className="space-y-1.5">
          {list.map((s) => {
            const usable = s.status === "enriched" && s.lat != null;
            return (
              <div
                key={s._id}
                className="rounded-xl bg-[var(--kf-card-sub)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {usable ? (
                      <CheckCircle2
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: "var(--kf-pass)" }}
                      />
                    ) : (
                      <XCircle
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: "var(--kf-ink-3)" }}
                      />
                    )}
                    <span className="truncate text-[12.5px] font-semibold text-[var(--kf-ink)]">
                      {s.name}
                    </span>
                    <a
                      href={s.sourceUrl ?? s.website}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-[var(--kf-ink-3)] hover:text-[var(--kf-running)]"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                  <span
                    className="shrink-0 font-mono text-[10.5px] font-semibold"
                    style={{
                      color: usable ? "var(--kf-pass)" : "var(--kf-ink-3)",
                    }}
                  >
                    {s.receivingFrom || s.receivingTo
                      ? `${s.receivingFrom ?? "--"}-${s.receivingTo ?? "--"}`
                      : "no hours"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-[var(--kf-ink-2)]">
                  {s.address ?? "No street address published on this site"}
                </p>
                {s.notes && (
                  <p className="mt-1 text-[10px] italic leading-snug text-[var(--kf-ink-3)]">
                    {s.notes}
                  </p>
                )}
              </div>
            );
          })}
          {list.length === 0 && (
            <p className="py-8 text-center text-[11.5px] text-[var(--kf-ink-3)]">
              No suppliers yet. Press Suppliers in the top bar to load the demo
              network, or add one below.
            </p>
          )}
        </div>
      </Panel>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2.5">
        <Panel title="Add a supplier" sub="Context.dev reads its website" bodyClassName="px-3 pb-3">
          <label className="mb-1.5 block">
            <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--kf-ink-3)]">
              Company name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Al Futtaim Logistics"
              className="w-full rounded-lg bg-[var(--kf-card-sub)] px-3 py-2 text-[12px] text-[var(--kf-ink)] outline-none ring-1 ring-[var(--kf-border)] placeholder:text-[var(--kf-ink-3)] focus:ring-[var(--kf-accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--kf-ink-3)]">
              Website
            </span>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="example.ae"
              spellCheck={false}
              className="w-full rounded-lg bg-[var(--kf-card-sub)] px-3 py-2 font-mono text-[12px] text-[var(--kf-ink)] outline-none ring-1 ring-[var(--kf-border)] placeholder:text-[var(--kf-ink-3)] focus:ring-[var(--kf-accent)]"
            />
          </label>
          {error && (
            <p className="mt-2 text-[11px] text-[var(--kf-fail)]">{error}</p>
          )}
          <button
            onClick={add}
            disabled={busy}
            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11.5px] font-semibold text-white transition disabled:opacity-50"
            style={{ background: "var(--kf-accent)" }}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 kf-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add and enrich
          </button>
          <p className="mt-2 text-[9.5px] leading-relaxed text-[var(--kf-ink-3)]">
            Only suppliers with a resolvable street address can be routed. Sites
            that publish no address are kept but marked unusable rather than
            given an invented location.
          </p>
        </Panel>

        <Panel title="Extraction log" sub="Context.dev events" bodyClassName="px-3 pb-3">
          <ol>
            {contextEvents.map((e) => (
              <li key={e._id} className="flex gap-2 py-1">
                <span className="w-[44px] shrink-0 font-mono text-[9px] tabular-nums text-[var(--kf-ink-3)]">
                  {new Date(e.timestamp).toLocaleTimeString("en-GB", {
                    hour12: false,
                  })}
                </span>
                <span className="min-w-0 flex-1 text-[10.5px] leading-snug text-[var(--kf-ink-2)]">
                  {e.message}
                </span>
              </li>
            ))}
          </ol>
          {contextEvents.length === 0 && (
            <p className="py-6 text-center text-[11.5px] text-[var(--kf-ink-3)]">
              No extraction events on the current run.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
