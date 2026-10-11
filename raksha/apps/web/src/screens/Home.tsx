import { useEffect, useState } from "react";
import { m as motion } from "motion/react";
import { BarChart3, Eye, Footprints, Layers, Locate, Phone, Settings as Cog, ShieldCheck } from "lucide-react";
import { type Band } from "@raksha/core";
import { CompanionBar } from "../components/CompanionBar";
import { HoldToSosButton } from "../components/HoldToSosButton";
import { IconButton, QuickAction, SearchPill, TimeBandChip } from "../components/ui";
import { ReasonsSheet } from "../components/ReasonsSheet";
import { SafeSpotsSheet } from "../components/SafeSpotsSheet";
import { DistrictSheet } from "../components/DistrictSheet";
import { useCity } from "../store/city";
import { nextNonce, useMapUi } from "../store/mapUi";
import { useSettings } from "../store/settings";
import { useJourney, greet, holdSosComplete, manualGuard } from "../store/journey";
import { navigate } from "../lib/router";
import { useBand } from "../lib/useBand";
import { clock, fmtClock } from "../lib/clock";
import { useNow } from "../lib/useNow";
import { useT } from "../i18n";

const CYCLE: Band[] = ["day", "evening", "night"];

export default function Home() {
  const t = useT();
  const index = useCity((s) => s.index);
  const nRegions = useCity((s) => s.regions.length);
  const coverageAt = useCity((s) => s.coverageAt);
  const cityStatus = useCity((s) => s.status);
  const hexTap = useMapUi((s) => s.hexTap);
  const user = useJourney((s) => s.user);
  const hasLine = useJourney((s) => !!s.sakhi.text);
  const { showHex, testMode, set } = useSettings();
  const band = useBand();
  useNow(20_000);
  const [hex, setHex] = useState<string | null>(null);
  const [spots, setSpots] = useState(false);
  const [district, setDistrict] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  useEffect(() => { if (hexTap) setHex(hexTap.h3); }, [hexTap]);
  useEffect(() => { if (!hasLine) greet(); }, [hasLine]);

  const here = user ? coverageAt(user.lat, user.lng) : undefined;
  const covered = !user || (index.length === 0 && nRegions === 0) || !!coverageAt(user.lat, user.lng);
  const time = fmtClock(clock.now());
  // in Test mode the chip cycles the pretend time of day; otherwise it is just the clock
  const cycle = testMode ? () => set({ demoBand: CYCLE[(CYCLE.indexOf(band) + 1) % 3]! }) : undefined;

  return (
    <div className="pointer-events-none absolute inset-0" data-testid="home">
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-bg-0/90 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-80 bg-gradient-to-t from-bg-0/95 via-bg-0/60 to-transparent" />

      <div className="pointer-events-auto absolute inset-x-4 top-14 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">raksha</span>
          <div className="flex items-center gap-2">
            <TimeBandChip label={`${t(`band.${band}`)} · ${time}`} onClick={cycle} />
            <IconButton label={t("home.settings")} testid="open-settings" onClick={() => navigate("/settings")}><Cog size={18} strokeWidth={1.75} /></IconButton>
          </div>
        </div>
        <CompanionBar />
        {cityStatus === "loading" && <p className="chip glass" role="status">{t("home.loadingCity")}</p>}
        {!online && <p className="chip glass" role="status">{t("home.offline")}</p>}
        {!covered && <p className="chip glass" role="status" data-testid="no-coverage">{t("home.noCoverage")}</p>}
      </div>

      <div className="pointer-events-auto absolute right-4 top-[300px] flex flex-col items-end gap-2">
        <button className="glass flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold" aria-pressed={showHex} data-testid="toggle-hex" style={{ color: showHex ? "var(--brand-soft)" : "var(--text-2)" }} onClick={() => set({ showHex: !showHex })}>
          <Layers size={16} strokeWidth={1.75} />{t("home.layer")}
        </button>
        <button className="glass flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold" data-testid="open-district" style={{ color: "var(--brand-soft)" }} onClick={() => setDistrict(true)}><BarChart3 size={16} strokeWidth={1.75} />{t("home.district")}</button>
        <IconButton label={t("home.locate")} testid="locate" onClick={() => user && useMapUi.getState().set({ flyTo: { lng: user.lng, lat: user.lat, zoom: 16, nonce: nextNonce() } })}><Locate size={20} strokeWidth={1.75} /></IconButton>
      </div>

      <motion.div className="pointer-events-auto absolute inset-x-4 bottom-0 space-y-3 safe-bottom" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 170, damping: 26 }}>
        <SearchPill label={t("home.search")} onClick={() => navigate("/search")} />
        <div className="grid grid-cols-4 gap-2">
          <QuickAction icon={Footprints} label={t("home.walk")} testid="walk-with-me" onClick={() => navigate("/search")} />
          <QuickAction icon={Phone} label={t("home.fakeCall")} testid="open-fake-call" onClick={() => navigate("/fake-call")} />
          <QuickAction icon={ShieldCheck} label={t("home.spots")} testid="open-spots" onClick={() => setSpots(true)} />
          <QuickAction icon={Eye} label={t("home.circle")} testid="open-circle" onClick={() => navigate("/circle")} />
        </div>
        <div className="relative flex h-[72px] items-center justify-center">
          <HoldToSosButton onComplete={holdSosComplete} size="M" />
          <button className="absolute right-0 min-h-11 text-sm font-semibold" style={{ color: "var(--brand-soft)" }} data-testid="guard-now" onClick={() => manualGuard(true)}>{t("home.guardNow")}</button>
        </div>
      </motion.div>

      <ReasonsSheet h3={hex} band={band} onClose={() => setHex(null)} />
      <SafeSpotsSheet open={spots} onOpenChange={setSpots} />
      <DistrictSheet open={district} onOpenChange={setDistrict} cityId={here?.kind === "city" ? here.id : undefined} regionState={here?.kind === "region" ? here.ncrbState : undefined} cityName={here?.name} />
    </div>
  );
}
