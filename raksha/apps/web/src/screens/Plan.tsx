import { useState } from "react";
import { m as motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { explainStretches, tradeoff, type RouteAssessment } from "@raksha/core";
import { RouteCard, RouteSkeleton } from "../components/RouteCard";
import { CompanionBar } from "../components/CompanionBar";
import { HoldToSosButton } from "../components/HoldToSosButton";
import { IconButton, Segmented, Toggle } from "../components/ui";
import { useJourney, clearPlan, holdSosComplete, planRoute, selectRoute, startJourney } from "../store/journey";
import { useCity } from "../store/city";
import { useSession } from "../store/session";
import { useSettings } from "../store/settings";
import { navigate } from "../lib/router";
import { useT } from "../i18n";

export default function Plan() {
  const t = useT();
  const plan = useJourney((s) => s.plan);
  const spots = useCity((s) => s.spots);
  const contact = useSession((s) => s.circle[0]?.name);
  const { shareWalk, checkLate, testMode, set } = useSettings();
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!plan) return null;
  const { choice, selectedId, assessments } = plan;
  const cards: { label: "safest" | "balanced" | "fastest"; a: RouteAssessment }[] = [];
  if (choice) {
    cards.push({ label: "safest", a: choice.safest });
    if (choice.balanced) cards.push({ label: "balanced", a: choice.balanced });
    if (choice.fastest.id !== choice.safest.id) cards.push({ label: "fastest", a: choice.fastest });
  }
  const loading = plan.status === "loading";
  const back = () => { clearPlan(); navigate("/search"); };

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="plan">
      <div className="pointer-events-auto absolute inset-x-4 top-14"><CompanionBar orb={loading ? "thinking" : undefined} text={loading ? t("plan.thinking") : undefined} /></div>
      <motion.div className="pointer-events-auto absolute inset-x-0 bottom-0 flex h-[530px] max-h-[75dvh] flex-col rounded-t-[28px] bg-bg-1 px-4 pt-4 shadow-elev safe-bottom"
        initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 32 }}>
        <div className="flex items-center gap-2">
          <IconButton label={t("common.back")} testid="plan-back" onClick={back}><ArrowLeft size={20} strokeWidth={1.75} /></IconButton>
          <div className="min-w-0 flex-1"><p className="truncate text-lg font-semibold leading-6">{t("plan.toDest", { dest: plan.toName })}</p><button className="block max-w-full truncate text-left text-xs text-text-2 underline decoration-dotted underline-offset-2" data-testid="change-start" onClick={() => { useJourney.setState({ searchFor: "start" }); navigate("/search"); }}>{t("plan.from")} {plan.fromName} ▾</button></div>
          <Segmented value={plan.mode} onChange={(m) => m !== plan.mode && void planRoute(plan.from, plan.fromName, plan.to, plan.toName, m)} testid="mode"
            options={[["walk", t("plan.walk")], ["vehicle", t("plan.autoCab")]]} label={t("plan.title")} />
        </div>

        <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto pb-2 scroll-hide">
          {loading && <><RouteSkeleton /><RouteSkeleton /></>}
          {plan.status === "error" && <p className="card p-4 text-center" role="alert" style={{ color: "var(--cls-extra-care)" }}>{t("plan.error")}</p>}
          {plan.status === "empty" && <p className="card p-4 text-center" role="alert">{t("plan.noRoute")}</p>}
          {plan.status === "ready" && cards.map(({ label, a }) => {
            const sel = a.id === selectedId;
            return (
              <RouteCard key={`${label}-${a.id}`} a={a} label={label} selected={sel} expanded={sel && expanded === a.id} pick={label === "safest"}
                tradeoff={choice ? tradeoff(a, choice.fastest) : { key: "route.fastestLit", params: { litPct: 0 } }} muchLonger={label === "safest" && !!choice?.safestMuchLonger}
                explanations={explainStretches(a, spots)} onSelect={() => { if (sel) setExpanded(expanded === a.id ? null : a.id); else { selectRoute(a.id); setExpanded(null); } }} />
            );
          })}
          {plan.status === "ready" && (assessments.find((a) => a.id === selectedId)?.lowDataFrac ?? 0) > 0.5 && <p className="px-1 text-center text-xs" style={{ color: "var(--cls-stay-alert)" }} data-testid="limited-data">{t("plan.limitedData")}</p>}
          {plan.status === "ready" && <p className="px-1 text-center text-xs text-text-3">{t("basedOn")}</p>}
          {plan.status === "ready" && testMode && <button className="btn btn-ghost h-11 w-full text-sm text-text-2" data-testid="simulate-walk" onClick={() => startJourney(true)}>{t("plan.simulate")}</button>}
        </div>

        <div className="border-t border-line py-1">
          <label className="flex min-h-12 items-center justify-between gap-3"><span className="text-[15px]">{t("plan.shareWalk", { contact: contact ?? t("plan.yourCircle") })}</span><Toggle on={shareWalk} onChange={(v) => set({ shareWalk: v })} label={t("plan.shareWalk", { contact: contact ?? "" })} testid="toggle-share-walk" /></label>
          <label className="flex min-h-12 items-center justify-between gap-3"><span className="text-[15px]">{t("plan.checkLate")}</span><Toggle on={checkLate} onChange={(v) => set({ checkLate: v })} label={t("plan.checkLate")} testid="toggle-check-late" /></label>
        </div>

        <div className="flex items-center gap-3">
          <HoldToSosButton onComplete={holdSosComplete} size={60} />
          <button className="btn btn-primary h-[60px] flex-1 text-base" data-testid="start-journey" disabled={plan.status !== "ready"} style={{ boxShadow: "var(--glow-brand)" }} onClick={() => startJourney(false)}>{t("plan.startWith")}</button>
        </div>
      </motion.div>
    </div>
  );
}
