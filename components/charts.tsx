"use client";

/** Segmented arc gauge, as used for utilisation dials in logistics consoles. */
export function SegmentGauge({
  pct,
  size = 190,
  segments = 12,
}: {
  pct: number;
  size?: number;
  segments?: number;
}) {
  const filled = Math.round((pct / 100) * segments);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 6;
  const rInner = rOuter - 26;

  // 200-degree sweep opening at the bottom.
  const START = -190;
  const SWEEP = 200;
  const gap = 3.2;
  const step = SWEEP / segments;

  const wedge = (from: number, to: number) => {
    const a1 = (from * Math.PI) / 180;
    const a2 = (to * Math.PI) / 180;
    const x1 = cx + rOuter * Math.cos(a1);
    const y1 = cy + rOuter * Math.sin(a1);
    const x2 = cx + rOuter * Math.cos(a2);
    const y2 = cy + rOuter * Math.sin(a2);
    const x3 = cx + rInner * Math.cos(a2);
    const y3 = cy + rInner * Math.sin(a2);
    const x4 = cx + rInner * Math.cos(a1);
    const y4 = cy + rInner * Math.sin(a1);
    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 0 0 ${x4} ${y4} Z`;
  };

  const wedges = Array.from({ length: segments }, (_, i) => {
    const from = START + i * step + gap / 2;
    const to = START + (i + 1) * step - gap / 2;
    const on = i < filled;
    // Ramp from pale to saturated across the filled arc.
    const t = segments > 1 ? i / (segments - 1) : 1;
    const color = on
      ? `color-mix(in srgb, var(--kf-accent) ${40 + t * 60}%, var(--kf-card))`
      : "rgba(255,255,255,0.08)";
    return { d: wedge(from, to), color, key: i };
  });

  return (
    <div className="relative" style={{ width: size, height: size * 0.66 }}>
      <svg width={size} height={size} className="absolute left-0 top-0">
        {wedges.map((w) => (
          <path key={w.key} d={w.d} fill={w.color} />
        ))}
      </svg>
      <div
        className="absolute inset-x-0 text-center"
        style={{ top: size * 0.33 }}
      >
        <span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums text-[var(--kf-ink)]">
          {pct}%
        </span>
      </div>
    </div>
  );
}

/** Utilisation histogram, red through green by bucket. */
export function BucketBars({
  buckets,
}: {
  buckets: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const colors = ["#e5484d", "#f07c34", "#f5c344", "#4fb96a", "#177f49"];

  return (
    <div className="flex h-[190px] items-end gap-3 px-1">
      {buckets.map((b, i) => {
        const h = (b.count / max) * 100;
        return (
          <div key={b.label} className="flex h-full flex-1 flex-col items-center gap-2">
            <div className="relative flex min-h-0 w-full flex-1 items-end justify-center">
              {b.count > 0 && (
                <span className="absolute -top-1 text-[10px] font-semibold tabular-nums text-[var(--kf-ink-2)]">
                  {b.count}
                </span>
              )}
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${Math.max(h, b.count > 0 ? 8 : 2)}%`,
                  background: colors[i],
                  opacity: b.count > 0 ? 0.9 : 0.18,
                }}
              />
            </div>
            <span
              className="text-[9.5px] font-semibold"
              style={{ color: colors[i] }}
            >
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Labelled metric with a filled track. */
export function MetricBar({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string;
  pct: number;
  color?: string;
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] text-[var(--kf-ink-2)]">{label}</span>
        <span className="text-[14px] font-semibold tabular-nums text-[var(--kf-ink)]">
          {value}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, Math.max(2, pct))}%`,
            background: color ?? "var(--kf-accent)",
          }}
        />
      </div>
    </div>
  );
}

/** Inline capacity bar used inside the consolidations table. */
export function UtilBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#177f49" : pct >= 60 ? "#4fb96a" : pct >= 40 ? "#f5c344" : "#f07c34";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[rgba(255,255,255,0.09)]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.min(100, pct)}%`, background: color }}
        />
      </span>
      <span className="text-[12px] font-semibold tabular-nums text-[var(--kf-ink)]">
        {pct}%
      </span>
    </span>
  );
}
