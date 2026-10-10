import { ArrowUp, CornerUpLeft, CornerUpRight, Flag, Pause, Play } from "lucide-react";
import { CompanionBar } from "../components/CompanionBar";
import { HeadsUpCard } from "../components/HeadsUpCard";
import { HoldToSosButton } from "../components/HoldToSosButton";
import { ProgressRoute } from "../components/ProgressRoute";
import { arrive, holdSosComplete, setSimStopped, useJourney } from "../store/journey";
import { useSettings } from "../store/settings";
import { clock, fmtClock } from "../lib/clock";
import { useNow } from "../lib/useNow";
import { useT } from "../i18n";

const clockTime = fmtClock;

export default function Journey() {
  const t = useT();
  const engine = useJourney((s) => s.engine);
  const plan = useJourney((s) => s.plan);
  const simulating = useJourney((s) => s.simulating);
  const stopped = useJourney((s) => s.simStopped);
  const hand = useSettings((s) => s.hand);
  const headsUp = useJourney((s) => s.card?.name === "heads_up");
  useNow(1000);
  const route = engine.route;
  if (!route) return null;
  const a = route.assessment;
  const total = route.cum.at(-1) ?? a.distanceM;
  const along = Math.min(total, engine.snap?.alongM ?? 0);
  const remaining = Math.max(0, total - along);
  const etaMin = Math.max(1, Math.round((a.durationS * (remaining / (total || 1))) / 60));

  // Next instruction: OSRM steps when we have them, otherwise the next weak stretch / remaining distance
  const steps = plan?.steps[a.id] ?? [];
  const step = steps.find((s) => s.startM > along + 5 && s.type !== "depart");
  const nextStretch = a.stretches.find((s) => s.endM > along);
  const dist = step ? Math.round(step.startM - along) : nextStretch ? Math.max(0, Math.round(nextStretch.startM - along)) : Math.round(remaining);
  const label = step ? (step.type === "arrive" ? t("journey.arrived") : step.name || t("journey.continue")) : t("journey.arrow");
  const Icon = step?.type === "arrive" ? Flag : step?.modifier?.includes("left") ? CornerUpLeft : step?.modifier?.includes("right") ? CornerUpRight : ArrowUp;
  const deadline = engine.timerDeadline && engine.timerDeadline < Number.MAX_SAFE_INTEGER / 2 ? engine.timerDeadline : null;

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="journey">
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-bg-0/90 to-transparent" />
      <div className="pointer-events-auto absolute inset-x-4 top-14 space-y-2.5">
        <div className="glass flex items-center gap-3 rounded-[20px] p-3" data-testid="instruction">
          <span className="grid size-[52px] shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink"><Icon size={26} strokeWidth={2} /></span>
          <div className="min-w-0"><p className="text-[22px] font-bold leading-7" data-testid="remaining">{dist} m</p><p className="truncate text-sm text-text-2">{label}</p></div>
          {simulating && <span className="chip ml-auto shrink-0" data-testid="sim-chip">{t("journey.sim")} · {engine.phase}</span>}
        </div>
        <CompanionBar text={headsUp ? t("journey.withYou") : undefined} />
        <HeadsUpCard />
      </div>

      <div className="pointer-events-auto absolute inset-x-0 bottom-0 rounded-t-[28px] bg-bg-1/95 px-4 pt-4 shadow-elev safe-bottom">
        {simulating && (
          <div className="mb-1 flex gap-2">
            <button className="btn h-10 flex-1 text-sm" data-testid="sim-stop" onClick={() => setSimStopped(!stopped)}>{stopped ? <Play size={16} /> : <Pause size={16} />}{stopped ? t("common.start") : t("journey.stopHere")}</button>
            <button className="btn h-10 flex-1 text-sm" data-testid="end-journey" onClick={arrive}>{t("journey.end")}</button>
          </div>
        )}
        <ProgressRoute a={a} alongM={along} totalM={total} />
        <div className="flex items-end justify-between">
          <div><p className="text-[22px] font-bold leading-7" data-testid="eta">{clockTime(clock.now() + etaMin * 60_000)}</p>
            <p className="text-xs text-text-3">{(remaining / 1000).toFixed(1)} km · {t("plan.min", { n: etaMin })}</p></div>
          {deadline && <span className="chip" data-testid="checkin-chip">{t("journey.checkin", { t: clockTime(deadline) })}</span>}
        </div>
        <div className={`mt-3 flex items-center gap-3 ${hand === "left" ? "flex-row-reverse" : ""}`}>
          <HoldToSosButton onComplete={holdSosComplete} size="M" />
          <button className="btn btn-primary h-[60px] flex-1 text-base" data-testid="arrive" onClick={arrive}>{t("journey.arrived")}</button>
        </div>
      </div>
    </div>
  );
}
