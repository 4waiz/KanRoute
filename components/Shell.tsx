"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import {
  Globe,
  Home,
  Loader2,
  Map as MapIcon,
  Route as RouteIcon,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { LoadShareMark } from "@/components/Brand";

const NAV = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/routes", label: "Routes", icon: RouteIcon },
  { href: "/fleet", label: "Fleet", icon: Truck },
  { href: "/suppliers", label: "Suppliers", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * Fixed application chrome. The page body never scrolls on desktop; each
 * view fills the remaining height and scrolls internally where needed.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const seed = useMutation(api.suppliers.seedDemoSuppliers);
  const createRun = useMutation(api.runs.create);
  const stats = useQuery(api.stats.summary, {}) as
    | { suppliersMapped: number; suppliersTotal: number }
    | undefined;
  const latest = useQuery(api.runs.latest, {}) as
    | { status: string; devinStatusDetail?: string }
    | null
    | undefined;

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col lg:h-[100dvh] lg:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--kf-accent)]">
            <LoadShareMark size={16} color="#fff" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--kf-ink)]">
            LoadShare
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11px] text-[var(--kf-ink-3)] sm:inline">
            {stats?.suppliersMapped ?? 0}/{stats?.suppliersTotal ?? 0} suppliers ·{" "}
            <StatusText
              status={latest?.status}
              detail={latest?.devinStatusDetail}
            />
          </span>
          <button
            onClick={() => act(() => seed({}), "seed")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--kf-card)] px-3 py-2 text-[11.5px] font-semibold text-[var(--kf-ink-2)] ring-1 ring-[var(--kf-border)] transition hover:text-[var(--kf-ink)] disabled:opacity-50"
          >
            {busy === "seed" ? (
              <Loader2 className="h-3.5 w-3.5 kf-spin" />
            ) : (
              <Globe className="h-3.5 w-3.5" />
            )}
            Suppliers
          </button>
          <button
            onClick={() =>
              act(
                () => createRun({ name: "Dubai last-mile consolidation" }),
                "run",
              )
            }
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11.5px] font-semibold text-white transition disabled:opacity-50"
            style={{ background: "var(--kf-accent)" }}
          >
            {busy === "run" ? (
              <Loader2 className="h-3.5 w-3.5 kf-spin" />
            ) : (
              <Truck className="h-3.5 w-3.5" />
            )}
            Run consolidation
          </button>
        </div>
      </header>

      {error && (
        <p className="shrink-0 px-4 pb-1 text-[12px] text-[var(--kf-fail)]">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1 gap-2.5 px-2.5 pb-2.5 sm:px-3.5 sm:pb-3.5">
        <nav className="hidden shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-[var(--kf-card)] p-1.5 ring-1 ring-[var(--kf-border)] lg:flex">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active =
              n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                title={n.label}
                aria-label={n.label}
                className={`grid h-9 w-9 place-items-center rounded-xl transition ${
                  active
                    ? "bg-[var(--kf-solid)] text-[var(--kf-solid-fg)]"
                    : "text-[var(--kf-ink-3)] hover:bg-[var(--kf-card-sub)] hover:text-[var(--kf-ink-2)]"
                }`}
              >
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
        </nav>

        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      </div>

      {/* Mobile nav, since the rail is desktop only */}
      <nav className="flex shrink-0 items-center justify-around border-t border-[var(--kf-border)] bg-[var(--kf-card)] px-2 py-1.5 lg:hidden">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active =
            n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-label={n.label}
              className={`grid h-9 w-9 place-items-center rounded-xl ${
                active
                  ? "bg-[var(--kf-solid)] text-[var(--kf-solid-fg)]"
                  : "text-[var(--kf-ink-3)]"
              }`}
            >
              <Icon className="h-4 w-4" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function StatusText({ status, detail }: { status?: string; detail?: string }) {
  if (status === "completed")
    return <span style={{ color: "var(--kf-pass)" }}>plan ready</span>;
  if (status === "failed" || status === "timeout")
    return <span style={{ color: "var(--kf-fail)" }}>failed</span>;
  if (!status) return <span>no run</span>;
  return (
    <span style={{ color: "var(--kf-running)" }}>
      optimising{detail ? ` (${detail.replace(/_/g, " ")})` : "…"}
    </span>
  );
}

/** Consistent panel chrome for every view. */
export function Panel({
  title,
  sub,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`kf-card flex min-h-0 flex-col overflow-hidden ${className}`}>
      {title && (
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-3">
          <div className="min-w-0">
            <h2 className="truncate text-[12.5px] font-semibold tracking-tight text-[var(--kf-ink)]">
              {title}
            </h2>
            {sub && (
              <p className="truncate text-[10px] text-[var(--kf-ink-3)]">{sub}</p>
            )}
          </div>
          {right}
        </div>
      )}
      <div className={`min-h-0 flex-1 overflow-auto ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}
