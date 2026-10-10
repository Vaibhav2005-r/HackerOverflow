import { useState } from "react";
import { m as motion } from "motion/react";
import { MapPin, Phone, Share2, Siren } from "lucide-react";
import { CompanionOrb } from "../components/CompanionOrb";
import { HoldToSosButton } from "../components/HoldToSosButton";
import { SafeSpotsSheet } from "../components/SafeSpotsSheet";
import { Segmented } from "../components/ui";
import { useJourney, ensureLiveShare, holdSosComplete, manualGuard, toggleSiren } from "../store/journey";
import { useSettings } from "../store/settings";
import { shareText } from "../lib/share";
import { navigate } from "../lib/router";
import { useT } from "../i18n";
import { cx } from "../lib/cx";

function Tile({ icon, label, onClick, testid, active }: { icon: React.ReactNode; label: string; onClick: () => void; testid?: string; active?: boolean }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={onClick} data-testid={testid} aria-pressed={active}
      className="flex h-[84px] w-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-1 text-xs font-medium" style={{ boxShadow: active ? "0 0 0 1.5px var(--cls-extra-care)" : "0 0 0 1px var(--line)" }}>
      <span style={{ color: "var(--sakhi-a)" }}>{icon}</span>{label}
    </motion.button>
  );
}

/** Guard mode: map on top (~310 px), one-hand dock below. Everything that matters is within thumb reach. */
export default function Guard() {
  const t = useT();
  const sakhi = useJourney((s) => s.sakhi.text);
  const siren = useJourney((s) => s.siren);
  const armed = useJourney((s) => s.shakeArmed);
  const hasRoute = useJourney((s) => !!s.engine.route);
  const { hand, name, set } = useSettings();
  const [spots, setSpots] = useState(false);
  const share = async () => { const s = await ensureLiveShare(); if (s) await shareText(t("sos.shareText", { name: name || "I" }), s.url); };
  const end = () => { manualGuard(false); navigate(hasRoute ? "/journey" : "/"); };

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="guard">
      <motion.div className="pointer-events-none fixed inset-0 z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.42 }}
        style={{ boxShadow: "inset 0 0 0 1px rgba(255,122,107,.45), inset 0 0 70px rgba(255,122,107,.26)" }} />
      <motion.div className="pointer-events-auto absolute inset-x-0 bottom-0 top-[280px] z-20 flex flex-col rounded-t-[28px] bg-bg-1 px-4 pt-4 shadow-elev safe-bottom"
        initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 32 }}>
        <div className="flex items-center gap-3">
          <CompanionOrb state="guard" size={56} />
          <div className="min-w-0">
            <p className="eyebrow" style={{ color: "var(--cls-extra-care)" }} data-testid="guard-overline">{t("guard.modeOn")}</p>
            <p className="text-[15px] font-medium leading-[22px] [text-wrap:pretty]" aria-live="polite" role="status" data-testid="sakhi-text">{sakhi || t("guard.title")}</p>
          </div>
        </div>

        <div className={cx("my-4 flex items-center justify-between gap-2", hand === "left" && "flex-row-reverse")} data-testid="guard-dock">
          <div className="flex flex-col gap-2">
            <Tile icon={<Siren size={22} strokeWidth={1.75} />} label={t("guard.siren")} active={siren} testid="tile-siren" onClick={toggleSiren} />
            <Tile icon={<Share2 size={22} strokeWidth={1.75} />} label={t("guard.shareLive")} testid="tile-share" onClick={() => void share()} />
          </div>
          <HoldToSosButton onComplete={holdSosComplete} size="XL" />
          <div className="flex flex-col gap-2">
            <Tile icon={<Phone size={22} strokeWidth={1.75} />} label={t("guard.fakeCall")} testid="tile-fake" onClick={() => navigate("/fake-call")} />
            <Tile icon={<MapPin size={22} strokeWidth={1.75} />} label={t("guard.safeSpot")} testid="tile-spot" onClick={() => setSpots(true)} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="chip" data-testid="shake-chip"><span className="size-2 rounded-full" style={{ background: armed ? "var(--cls-comfortable)" : "var(--text-3)" }} />{armed ? t("guard.shakeOn") : t("guard.shakeOff")}</span>
          <Segmented value={hand} onChange={(h) => set({ hand: h })} testid="hand" label={t("set.hand")} options={[["left", t("guard.handLeft")], ["right", t("guard.handRight")]]} />
        </div>
        <button className="btn btn-ghost mt-auto h-14 w-full" data-testid="exit-guard" onClick={end}>{t("guard.endGuard")}</button>
      </motion.div>
      <SafeSpotsSheet open={spots} onOpenChange={setSpots} />
    </div>
  );
}
