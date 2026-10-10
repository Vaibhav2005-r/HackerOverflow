import { m as motion } from "motion/react";
import type { MessageRef, RouteAssessment, StretchExplanation } from "@raksha/core";
import { SafetyRing } from "./SafetyRing";
import { StretchRow } from "./StretchRow";
import { CLASS_COLOR } from "../map/colors";
import { useT } from "../i18n";

export function RouteSkeleton() {
  return <div className="h-[84px] rounded-[20px] bg-surface-1 shadow-[0_0_0_1px_var(--line)]" style={{ animation: "skeleton 1.4s ease-in-out infinite" }} data-testid="route-skeleton" />;
}

export function RouteCard({ a, label, tradeoff, selected, expanded, pick, muchLonger, explanations, onSelect }: {
  a: RouteAssessment; label: "safest" | "balanced" | "fastest"; tradeoff: MessageRef; selected: boolean; expanded: boolean; pick?: boolean; muchLonger?: boolean;
  explanations: StretchExplanation[]; onSelect: () => void;
}) {
  const t = useT();
  const n = a.stretches.length;
  return (
    <motion.div layout className="rounded-[20px] p-3.5 text-left" data-testid={`route-card-${label}`} data-selected={selected}
      style={selected ? { background: "var(--surface-2)", boxShadow: "0 0 0 1.5px var(--brand), 0 0 24px rgba(142,124,255,.2)" } : { background: "var(--surface-1)", boxShadow: "0 0 0 1px var(--line)" }}>
      <button type="button" className="flex w-full items-center gap-3 text-left" aria-pressed={selected} aria-expanded={expanded} onClick={onSelect}>
        <SafetyRing value={a.rsi} cls={a.cls} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold">{t(`route.${label}`)}</span>
            {pick && <span className="rounded-full px-2.5 text-[11px] font-bold leading-[22px] text-brand-ink" style={{ background: "linear-gradient(90deg, var(--sakhi-a), var(--sakhi-b))" }}>{t("route.pick")}</span>}
          </div>
          <p className="mt-0.5 text-[13px] leading-[18px] text-text-2">{t(tradeoff.key, tradeoff.params)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
            <span className="size-2 rounded-full" style={{ background: CLASS_COLOR[a.cls] }} />{t(`class.${a.cls}`)}
            <span className="font-normal text-text-3">· {n === 0 ? t("route.noStretches") : t("route.watch", { n })}</span>
          </p>
          {muchLonger && <p className="mt-1 text-xs font-semibold" style={{ color: "var(--cls-stay-alert)" }}>{t("route.muchLonger")}</p>}
        </div>
        <div className="text-right"><p className="text-lg font-bold leading-6">{t("plan.min", { n: Math.round(a.durationS / 60) })}</p><p className="text-xs text-text-3">{t("plan.km", { n: (a.distanceM / 1000).toFixed(1) })}</p></div>
      </button>
      {expanded && n > 0 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 overflow-hidden border-t border-line pt-1" data-testid="weak-stretches">
          {a.stretches.slice(0, 5).map((s) => <StretchRow key={s.id} stretch={s} exp={explanations.find((e) => e.stretchId === s.id)} />)}
        </motion.div>
      )}
    </motion.div>
  );
}
