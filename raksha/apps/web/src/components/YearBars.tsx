/** Tiny bar chart of yearly totals. Neutral colour on purpose: this is context, not a danger rating. */
export function YearBars({ years, totals, label }: { years: number[]; totals: (number | null)[]; label: string }) {
  const max = Math.max(1, ...totals.map((t) => t ?? 0));
  return (
    <svg viewBox={`0 0 ${years.length * 44} 90`} className="h-24 w-full" role="img" aria-label={label}>
      {years.map((y, i) => {
        const v = totals[i], h = v == null ? 0 : Math.max(2, (v / max) * 60);
        return (
          <g key={y} transform={`translate(${i * 44 + 6} 0)`}>
            <rect x="0" y={66 - h} width="30" height={h} rx="4" fill="var(--brand-soft)" opacity={i === years.length - 1 ? 1 : 0.55} />
            <text x="15" y="80" textAnchor="middle" fontSize="10" fill="var(--text-2)">{String(y).slice(2)}</text>
            {v != null && <text x="15" y={60 - h} textAnchor="middle" fontSize="9" fill="var(--text-2)">{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}</text>}
          </g>
        );
      })}
    </svg>
  );
}
