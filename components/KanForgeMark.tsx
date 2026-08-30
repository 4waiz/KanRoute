/** KanForge mark: an anvil-derived hexagon with a struck cleft. Pure SVG. */
export function KanForgeMark({
  size = 26,
  color = "var(--kf-accent)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 2.5 27.2 9v14L16 29.5 4.8 23V9L16 2.5Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M11 12.5h10L17.4 16l3.6 3.5H11"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KanForgeWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <KanForgeMark size={compact ? 22 : 28} />
      <div className="leading-none">
        <div
          className={`font-semibold tracking-tight ${compact ? "text-[15px]" : "text-lg"}`}
        >
          <span className="text-[var(--kf-ink)]">KAN</span>
          <span style={{ color: "var(--kf-accent)" }}>FORGE</span>
        </div>
        {!compact && (
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--kf-ink-3)]">
            Claims in. Evidence out.
          </div>
        )}
      </div>
    </div>
  );
}
