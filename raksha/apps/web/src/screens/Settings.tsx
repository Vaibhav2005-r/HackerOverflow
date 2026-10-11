import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PinSetup } from "../components/PinSetup";
import { AccountCard } from "../components/AccountCard";
import { Segmented as Seg, Toggle } from "../components/ui";
import { useSettings, type SettingsState } from "../store/settings";
import { useJourney, ensureLiveShare, simulateShake } from "../store/journey";
import { backendNotice, getBackend } from "../services/backend";
import { navigate } from "../lib/router";
import { useT } from "../i18n";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2"><span className="font-medium">{label}</span>{children}</div>;
}
export default function Settings() {
  const t = useT();
  const s = useSettings();
  const set = s.set as (p: Partial<SettingsState>) => void;
  const share = useJourney((j) => j.share);
  const sos = useJourney((j) => j.sos);
  const [changing, setChanging] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const backend = getBackend();
  const [, refresh] = useState(0);
  useEffect(() => { void backend.signIn().then(() => refresh((n) => n + 1)); }, [backend]); // the badge reflects a local fallback once sign-in settles

  const openContact = async () => {
    const token = sos?.token ?? share?.token ?? (await ensureLiveShare())?.token;
    if (token) window.open(`/s/${token}`, "_blank");
  };
  const wipe = async () => {
    await backend.deleteMyData();
    for (const k of Object.keys(localStorage)) if (k.startsWith("raksha:")) localStorage.removeItem(k);
    s.reset();
    location.href = "/";
  };

  if (changing) {
    return (
      <div className="absolute inset-0 z-20 overflow-y-auto bg-bg-0 px-6 safe-top safe-bottom">
        <button className="btn !min-h-11 my-2" onClick={() => setChanging(false)}><ArrowLeft size={20} /></button>
        <PinSetup onDone={(pin, duress) => { set({ pin, duress }); setChanging(false); }} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-bg-0 px-5 safe-top safe-bottom" data-testid="settings">
      <div className="flex items-center gap-2 py-2"><button className="btn !min-h-11" onClick={() => navigate("/")} aria-label={t("common.back")}><ArrowLeft size={20} /></button><h1 className="text-xl font-bold">{t("set.title")}</h1><span className="chip ml-auto" data-testid="local-badge">{backend.kind === "local" ? t("set.localMode") : "Supabase"}</span></div>
      {backendNotice() && <p className="mb-2 text-xs text-text-2" data-testid="backend-notice">{t("set.backendDown")}: {backendNotice()}</p>}

      <Row label={t("set.language")}><Seg value={s.lang} options={[["en", "English"], ["hi", "हिन्दी"]]} onChange={(v) => set({ lang: v })} testid="lang" /></Row>
      <Row label={t("set.voice")}><Toggle on={s.voice} onChange={(voice) => set({ voice })} label={t("set.voice")} /></Row>
      <Row label={t("set.reduceMotion")}><Toggle on={s.reduceMotion} onChange={(reduceMotion) => set({ reduceMotion })} label={t("set.reduceMotion")} testid="toggle-reduce-motion" /></Row>
      <Row label={t("set.haptics")}><Toggle on={s.haptics} onChange={(haptics) => set({ haptics })} label={t("set.haptics")} /></Row>
      <Row label={t("set.sosMode")}><Seg value={s.sosMode} options={[["silent", t("sos.silent")], ["loud", t("sos.loud")]]} onChange={(sosMode) => set({ sosMode })} testid="sosmode" /></Row>
      <Row label={t("set.hand")}><Seg value={s.hand} options={[["left", t("guard.handLeft")], ["right", t("guard.handRight")]]} onChange={(hand) => set({ hand })} /></Row>
      <Row label={t("set.shakeAlways")}><Toggle on={s.shakeAlwaysArmed} onChange={(shakeAlwaysArmed) => set({ shakeAlwaysArmed })} label={t("set.shakeAlways")} /></Row>
      <Row label={t("set.pin")}><button className="btn" data-testid="change-pins" onClick={() => setChanging(true)}>{t("common.change")}</button></Row>

      <Row label={t("set.openContact")}><button className="btn" data-testid="open-contact-view" onClick={() => void openContact()}>{t("common.open")}</button></Row>

      <Row label={t("insights.title")}><button className="btn" data-testid="open-insights-settings" onClick={() => navigate("/insights")}>{t("common.open")}</button></Row>
      <AccountCard />

      <h2 className="mb-1 mt-8 text-sm font-semibold uppercase tracking-wide text-text-2">{t("set.testMode")}</h2>
      <Row label={t("set.testMode")}><Toggle on={s.testMode} onChange={(testMode) => set({ testMode })} label={t("set.testMode")} testid="toggle-test-mode" /></Row>
      <p className="mb-2 text-xs text-text-2">{t("set.testModeHint")}</p>
      {s.testMode && (
        <div data-testid="test-tools">
          <Row label={t("set.pretend")}><Seg value={s.demoBand} options={[["auto", "Auto"], ["day", t("band.day")], ["evening", t("band.evening")], ["night", t("band.night")]]} onChange={(demoBand) => set({ demoBand })} testid="pretend" /></Row>
          <Row label={t("set.speed")}><Seg value={s.simSpeed} options={[[1, "1×"], [5, "5×"], [15, "15×"], [40, "40×"]]} onChange={(simSpeed) => set({ simSpeed })} testid="speed" /></Row>
          <div className="mt-3"><button className="btn w-full" data-testid="sim-shake" onClick={simulateShake}>{t("set.simShake")}</button></div>
        </div>
      )}

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-text-2">{t("set.about")}</h2>
      <p className="text-sm text-text-2">{t("disclaimer")}</p>
      <div className="mt-3 flex gap-4 text-sm font-semibold" style={{ color: "var(--brand-soft)" }}><button className="underline" data-testid="open-privacy" onClick={() => navigate("/privacy")}>{t("legal.privacy")}</button><button className="underline" onClick={() => navigate("/terms")}>{t("legal.terms")}</button></div>
      <p className="mt-2 text-xs text-text-2">{t("set.attribution")}</p>

      <div className="mb-8 mt-8">
        {!confirm ? <button className="btn w-full !text-extra-care" onClick={() => setConfirm(true)}>{t("set.reset")}</button> : (
          <div className="card p-4"><p className="mb-3 text-sm">{t("set.resetConfirm")}</p><div className="flex gap-2"><button className="btn btn-sos flex-1" data-testid="confirm-wipe" onClick={() => void wipe()}>{t("common.delete")}</button><button className="btn flex-1" onClick={() => setConfirm(false)}>{t("common.cancel")}</button></div></div>
        )}
      </div>
    </div>
  );
}
