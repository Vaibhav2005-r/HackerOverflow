import { cancelCountdown, useJourney } from "../store/journey";
import { useNow } from "../lib/useNow";
import { useT } from "../i18n";

/** Shake- or timer-triggered countdown: 3 → 0, one haptic tick per second (from the engine), then SOS. */
export default function Countdown() {
  const t = useT();
  const cd = useJourney((s) => s.engine.countdown);
  const now = useNow(200);
  if (!cd) return null;
  const n = Math.max(0, Math.ceil((cd.endT - now) / 1000));
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-sos-bg px-6 pb-10 pt-24 text-center" data-testid="countdown" role="alertdialog" aria-live="assertive">
      <div>
        <p className="eyebrow text-sos">{cd.trigger === "shake" ? t("sos.shake") : t("sos.timerTrigger")}</p>
        <p className="mt-2 text-[180px] font-bold leading-none text-sos tabular-nums" data-testid="countdown-n">{n}</p>
        <p className="mt-2 text-lg text-text-2">{t("sos.alerting")}</p>
      </div>
      <button className="h-24 w-full rounded-3xl bg-text-1 text-2xl font-bold text-bg-0" data-testid="countdown-cancel" onClick={cancelCountdown}>{t("sos.cancelBtn")}</button>
    </div>
  );
}
