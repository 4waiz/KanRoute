/** LoadShare mark: three lanes merging into one. */
export function LoadShareMark({
  size = 26,
  color = "var(--kf-accent)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M3 7h9c6 0 6 9 12 9h5"
        stroke={color}
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M3 16h6c6 0 6 0 12 0h8"
        stroke={color}
        strokeWidth="2.1"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M3 25h9c6 0 6-9 12-9h5"
        stroke={color}
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="27" cy="16" r="3.2" fill={color} />
    </svg>
  );
}

export function LoadShareWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LoadShareMark size={compact ? 22 : 28} />
      <div className="leading-none">
        <div
          className={`font-semibold tracking-tight ${compact ? "text-[15px]" : "text-lg"}`}
        >
          <span className="text-[var(--kf-ink)]">LOAD</span>
          <span style={{ color: "var(--kf-accent)" }}>SHARE</span>
          <span className="ml-1.5 text-[var(--kf-ink-3)]">UAE</span>
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
