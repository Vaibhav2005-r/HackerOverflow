import { lineLength, type RouteAssessment } from "@raksha/core";
import { CLASS_COLOR } from "../map/colors";

/** 8 px class-coloured segments (3 px gap) weighted by length, with a teal "you are here" marker that glides 600 ms. */
export function ProgressRoute({ a, alongM, totalM }: { a: RouteAssessment; alongM: number; totalM: number }) {
  const segs = a.segmentsForMap.map((s) => ({ cls: s.cls, len: Math.max(1, lineLength(s.coords)) }));
  const pct = Math.max(0, Math.min(1, alongM / (totalM || 1))) * 100;
  return (
    <div className="relative py-2.5" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Route progress" data-testid="progress-route">
      <div className="flex gap-[3px]">
        {segs.map((s, i) => <div key={i} className="h-2 rounded-full" style={{ flex: s.len, background: CLASS_COLOR[s.cls] }} />)}
      </div>
      <span className="absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-[600ms]"
        style={{ left: `${pct}%`, background: "var(--sakhi-a)", boxShadow: "0 0 0 3px var(--bg-0), 0 0 14px var(--sakhi-a)" }} />
    </div>
  );
}
