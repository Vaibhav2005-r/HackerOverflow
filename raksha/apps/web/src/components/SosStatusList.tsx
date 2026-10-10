import { Check, Circle, CircleDot, Crosshair } from "lucide-react";
import { useJourney } from "../store/journey";
import { useSession } from "../store/session";
import { useNow } from "../lib/useNow";
import { useT } from "../i18n";

function Row({ icon, color, label, value, last }: { icon: React.ReactNode; color: string; label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex h-[52px] items-center gap-3 ${last ? "" : "border-b border-line"}`}>
      <span className="grid size-[22px] place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>{icon}</span>
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      <span className="text-[13px] text-text-2">{value}</span>
    </div>
  );
}

/** Honest status: a row shows ✓ only for things that are actually true on this device. */
export function SosStatusList() {
  const t = useT();
  const sos = useJourney((s) => s.sos);
  const shared = useJourney((s) => s.sosShared);
  const rec = useJourney((s) => s.recorder);
  const user = useJourney((s) => s.user);
  const circle = useSession((s) => s.circle);
  useNow(1000);
  const secs = rec.status === "recording" ? Math.floor((Date.now() - rec.startedAt) / 1000) : 0;
  const mmss = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div data-testid="sos-status">
      <Row color="var(--success)" icon={shared ? <Check size={13} strokeWidth={2.5} /> : <Circle size={11} />} label={t("sos.st.circle")} value={shared ? (circle[0]?.name ?? "") : t("sos.st.sendLink")} />
      <Row color="var(--success)" icon={sos?.url ? <Check size={13} strokeWidth={2.5} /> : <Circle size={11} />} label={t("sos.st.live")} value={sos?.url ? t("sos.st.liveOn") : t("sos.st.starting")} />
      <Row color="var(--sos)" icon={<CircleDot size={13} />} label={t("sos.st.rec")} value={rec.status === "recording" ? mmss : rec.status === "unavailable" ? t("sos.st.noMic") : "…"} />
      <Row color="var(--info)" icon={<Crosshair size={12} />} label={t("sos.st.acc")} value={user ? `±${Math.round(user.accuracy)} m` : "…"} last />
    </div>
  );
}
