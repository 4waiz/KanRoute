"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Package, Terminal } from "lucide-react";
import { Panel } from "@/components/Shell";
import { useConsole } from "@/components/useConsole";
import { ROUTE_COLORS } from "@/lib/routeColors";

export default function RoutesView() {
  const { routes, shipments, latest, stats } = useConsole();
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  const open = (routes ?? []).find((r) => r.label === openLabel) ?? null;
  const openIdx = (routes ?? []).findIndex((r) => r.label === openLabel);
  const openColor =
    openIdx >= 0 ? ROUTE_COLORS[openIdx % ROUTE_COLORS.length] : undefined;

  const openShipments = useMemo(
    () =>
      (shipments ?? []).filter((s) =>
        open ? open.shipmentRefs.includes(s.reference) : false,
      ),
    [shipments, open],
  );

  return (
    <div className="grid min-h-0 gap-2.5 lg:h-full lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel
        title="Consolidated routes"
        sub={`${(routes ?? []).length} routes across ${stats?.consignments ?? 0} consignments`}
        bodyClassName="px-2 pb-2"
      >
        <table className="w-full min-w-[680px] border-collapse">
          <thead className="sticky top-0 bg-[var(--kf-card)]">
            <tr className="text-left text-[9.5px] uppercase tracking-[0.06em] text-[var(--kf-ink-3)]">
              <Th>Route</Th>
              <Th>Drop zone</Th>
              <Th>Stops</Th>
              <Th>Load</Th>
              <Th>Fill</Th>
              <Th>Distance</Th>
              <Th>Window</Th>
              <Th>Consignments</Th>
            </tr>
          </thead>
          <tbody>
            {(routes ?? []).map((r, i) => {
              const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
              const cap = latest?.vehicleCapacityKg ?? 1200;
              const fill = Math.round((r.loadKg / cap) * 100);
              return (
                <tr
                  key={r._id}
                  onClick={() =>
                    setOpenLabel(openLabel === r.label ? null : r.label)
                  }
                  className="cursor-pointer border-t border-[var(--kf-border)] text-[11.5px] text-[var(--kf-ink)] transition hover:bg-[var(--kf-card-sub)]"
                  style={
                    openLabel === r.label
                      ? { background: "var(--kf-card-sub)" }
                      : {}
                  }
                >
                  <Td>
                    <span
                      className="grid h-6 w-6 place-items-center rounded-md text-[9px] font-bold text-white"
                      style={{ background: color }}
                    >
                      {r.label.replace(/[^0-9]/g, "") || r.label}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-medium">{r.zone}</span>
                  </Td>
                  <Td>{r.stopCount}</Td>
                  <Td>{r.loadKg} kg</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-[rgba(255,255,255,0.09)]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.min(100, fill)}%`,
                            background: color,
                          }}
                        />
                      </span>
                      {fill}%
                    </span>
                  </Td>
                  <Td>{r.distanceKm} km</Td>
                  <Td>
                    <span className="font-mono text-[10px]">
                      {r.windowStart}-{r.windowEnd}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[10px] text-[var(--kf-ink-3)]">
                      {r.shipmentRefs.join(" ")}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(routes ?? []).length === 0 && (
          <p className="px-2 py-8 text-center text-[11.5px] text-[var(--kf-ink-3)]">
            No routes yet. Run a consolidation from the top bar.
          </p>
        )}
      </Panel>

      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2.5">
        <Panel
          title={open ? `${open.label} · ${open.zone}` : "Route detail"}
          sub={open ? "Consignments on this vehicle" : "Select a route"}
          bodyClassName="px-3 pb-3"
        >
          {open ? (
            <div className="space-y-1.5">
              {openShipments.map((s, i) => (
                <div
                  key={s.reference}
                  className="rounded-lg bg-[var(--kf-card-sub)] px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="grid h-4 w-4 shrink-0 place-items-center rounded text-[8px] font-bold text-white"
                        style={{ background: openColor }}
                      >
                        {i + 1}
                      </span>
                      <span className="truncate text-[11.5px] font-semibold text-[var(--kf-ink)]">
                        {s.supplierName}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-[var(--kf-ink-3)]">
                      {s.reference}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 font-mono text-[9.5px] text-[var(--kf-ink-2)]">
                    <span>{s.weightKg} kg</span>
                    <span>·</span>
                    <span>
                      pickup {s.windowStart}-{s.windowEnd}
                    </span>
                    <span>·</span>
                    <span>to {s.destinationZone}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 py-6 text-center text-[11.5px] text-[var(--kf-ink-3)]">
              <Package className="h-3.5 w-3.5" />
              Pick a route to see its consignments.
            </p>
          )}
        </Panel>

        <Panel
          title="Optimiser"
          sub="Written and executed by Devin"
          right={
            <button
              onClick={() => setShowCode((s) => !s)}
              className="shrink-0 rounded-full bg-[var(--kf-card-sub)] px-2 py-1 text-[9.5px] font-semibold text-[var(--kf-ink-2)]"
            >
              {showCode ? "Show proof" : "Show code"}
            </button>
          }
          bodyClassName="p-2"
        >
          {showCode ? (
            latest?.optimiserCode ? (
              <pre className="whitespace-pre rounded-lg bg-[var(--kf-terminal)] p-2.5 font-mono text-[9px] leading-relaxed text-[var(--kf-ink-2)] ring-1 ring-[var(--kf-border)]">
                {latest.optimiserCode}
              </pre>
            ) : (
              <p className="p-2 text-[11.5px] text-[var(--kf-ink-3)]">
                No optimiser source returned.
              </p>
            )
          ) : latest?.proofOutput ? (
            <>
              <pre className="whitespace-pre rounded-lg bg-[var(--kf-terminal)] p-2.5 font-mono text-[9.5px] leading-relaxed text-[var(--kf-ink-2)] ring-1 ring-[var(--kf-border)]">
                {latest.proofOutput}
              </pre>
              {latest.devinSessionUrl && (
                <a
                  href={latest.devinSessionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--kf-running)] hover:underline"
                >
                  Open the Devin session
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </>
          ) : (
            <p className="flex items-center gap-1.5 p-2 text-[11.5px] text-[var(--kf-ink-3)]">
              <Terminal className="h-3.5 w-3.5" />
              No proof yet.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-1.5 pb-1.5 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-1.5 py-2 tabular-nums">{children}</td>;
}
