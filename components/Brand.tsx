import Image from "next/image";

/** Official KanRoute mark. */
export function KanRouteMark({ size = 26 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      priority
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export function KanRouteWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <KanRouteMark size={compact ? 24 : 30} />
      <div className="leading-none">
        <div
          className={`font-semibold tracking-tight ${compact ? "text-[15px]" : "text-lg"}`}
        >
          <span className="text-[var(--kf-ink)]">Kan</span>
          <span style={{ color: "var(--kf-accent)" }}>Route</span>
        </div>
        {!compact && (
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--kf-ink-3)]">
            Fewer vans. Same deliveries.
          </div>
        )}
      </div>
    </div>
  );
}
