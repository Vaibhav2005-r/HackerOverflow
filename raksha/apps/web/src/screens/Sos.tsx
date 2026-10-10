import { useEffect, useState } from "react";
import { ArrowLeft, Phone } from "lucide-react";
import { EMERGENCY, telLink } from "@raksha/core";
import { CompanionOrb } from "../components/CompanionOrb";
import { PinPad } from "../components/PinPad";
import { SosStatusList } from "../components/SosStatusList";
import { markSosShared, setSosMode, submitPin, toggleSiren, useJourney } from "../store/journey";
import { useSession } from "../store/session";
import { useSettings } from "../store/settings";
import { contactLinks, shareText } from "../lib/share";
import { navigate } from "../lib/router";
import { useT } from "../i18n";

/** SOS active. Silent is dark and quiet; loud adds a pulsing wash and the siren. Real and duress PINs follow identical UI. */
export default function Sos() {
  const t = useT();
  const sos = useJourney((s) => s.sos);
  const card = useJourney((s) => s.card);
  const text = useJourney((s) => s.sakhi.text);
  const siren = useJourney((s) => s.siren);
  const phase = useJourney((s) => s.engine.phase);
  const resolvedOpen = useJourney((s) => s.resolvedOpen);
  const circle = useSession((s) => s.circle);
  const name = useSettings((s) => s.name);
  const [pin, setPin] = useState(false);

  useEffect(() => { if (!sos && phase !== "SOS_ACTIVE" && !resolvedOpen) navigate("/", true); }, [sos, phase, resolvedOpen]);
  if (!sos) return null;
  const loud = sos.mode === "loud";
  const msg = text || t(loud ? "sos.overlineLoud" : "sos.overlineSilent");
  const share = `${t("sos.shareText", { name: name || "I" })}${sos.url ? ` ${sos.url}` : ""}`;
  const err = card?.name === "pin_wrong" ? t("sos.pinWrong") : card?.name === "pin_locked" ? t("sos.locked") : "";

  if (pin) {
    return (
      <div className="absolute inset-0 z-20 flex flex-col bg-sos-silent px-4 pt-14 safe-bottom" data-testid="sos-pin">
        <button className="btn size-12 !min-h-12 !rounded-full !p-0" aria-label={t("common.back")} onClick={() => setPin(false)}><ArrowLeft size={20} strokeWidth={1.75} /></button>
        <div className="flex flex-1 items-center"><PinPad title={t("sos.pinTitle")} sub={t("sos.pinSub")} error={err} errorKey={card?.n} onSubmit={(p) => void submitPin(p)} /></div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-y-auto px-4 pt-14 safe-bottom" style={{ background: loud ? "var(--sos-bg)" : "var(--sos-silent-bg)" }} data-testid="sos-screen" data-mode={sos.mode}>
      {loud && <div className="pointer-events-none fixed inset-0 bg-sos" style={{ animation: "pulse-sos 1s ease-in-out infinite" }} />}
      <div className="relative flex items-center gap-4">
        <CompanionOrb state="sos" size={56} />
        <div className="min-w-0" aria-live="assertive" role="status">
          <p className="eyebrow text-sos" data-testid="sos-title">{loud ? t("sos.overlineLoud") : t("sos.overlineSilent")}</p>
          <p className="text-[15px] font-medium leading-[22px] [text-wrap:pretty]">{msg}</p>
        </div>
      </div>

      <div className="relative mt-4"><SosStatusList /></div>

      {(sos.url || sos.failed) && (
        <div className="relative mt-3 space-y-2">
          {circle.map((c) => {
            const l = contactLinks(c, share);
            return (
              <div key={c.id} className="flex items-center gap-2 rounded-2xl bg-surface-1 p-2 pl-4">
                <span className="flex-1 font-semibold">{c.name}</span>
                <a className="btn h-11 !bg-[#25d366] !text-black" href={l.whatsapp} target="_blank" rel="noreferrer" onClick={markSosShared}>WhatsApp</a>
                <a className="btn h-11" href={l.sms} onClick={markSosShared}>SMS</a>
              </div>
            );
          })}
          {sos.url && <p className="break-all rounded-xl bg-surface-1 p-3 text-xs text-text-2" data-testid="sos-link">{sos.url}</p>}
        </div>
      )}

      <div className="relative mt-auto space-y-2.5 pt-6">
        <a className="flex h-[76px] items-center justify-center gap-2 rounded-2xl bg-sos text-[22px] font-bold text-white" href={telLink(EMERGENCY.police)} data-testid="sos-call-112"><Phone strokeWidth={2} />{t("guard.call112")}</a>
        <div className="grid grid-cols-2 gap-2.5">
          <button className="btn h-14" data-testid="sos-send-again" onClick={() => { markSosShared(); void shareText(t("sos.shareText", { name: name || "I" }), sos.url); }}>{t("sos.sendAgain")}</button>
          {loud && siren
            ? <button className="btn h-14" data-testid="sos-mute" onClick={toggleSiren}>{t("sos.mute")}</button>
            : <button className="btn h-14" data-testid="sos-loud" onClick={() => setSosMode(loud ? "silent" : "loud")}>{loud ? t("sos.toSilent") : t("sos.toLoud")}</button>}
        </div>
        <button className="btn btn-ghost h-14 w-full" data-testid="sos-cancel" style={{ boxShadow: "0 0 0 1px var(--line)" }} onClick={() => setPin(true)}>{t("sos.imSafe")}</button>
      </div>
    </div>
  );
}
