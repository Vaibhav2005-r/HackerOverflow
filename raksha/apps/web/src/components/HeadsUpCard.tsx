import { m as motion } from "motion/react";
import { Moon } from "lucide-react";
import { dismissCard, takeDetour, ensureLiveShare, useJourney } from "../store/journey";
import { useSettings } from "../store/settings";
import { shareText } from "../lib/share";
import { useT } from "../i18n";

/** Slides down from under the companion bar. Amber ring + glow; primary action is the lit detour when one exists. */
export function HeadsUpCard() {
  const t = useT();
  const card = useJourney((s) => s.card);
  const text = useJourney((s) => s.sakhi.text);
  const name = useSettings((s) => s.name);
  if (card?.name !== "heads_up") return null;
  const d = card.data as { distanceM: number; saferDetour: { routeId: string; extraMinutes: number } | null; tip: { key: string; params: Record<string, string | number> } | null };
  const share = async () => { const s = await ensureLiveShare(); if (s) await shareText(t("sos.shareText", { name: name || "I" }), s.url); };
  return (
    <motion.div key={card.n} initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.42, ease: [0.2, 0.9, 0.3, 1] }} data-testid="card-heads-up"
      className="rounded-[20px] bg-surface-1 p-4" style={{ boxShadow: "0 0 0 1px rgba(255,181,71,.55), 0 0 32px rgba(255,181,71,.18)" }}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ background: "rgba(255,181,71,.22)", color: "var(--cls-stay-alert)" }}><Moon size={18} strokeWidth={1.75} /></span>
        <div>
          <p className="text-base font-medium leading-6">{text || t("journey.inMeters", { m: d.distanceM })}</p>
          {d.tip && <p className="mt-1 text-[13px] leading-[18px] text-text-2">{t(d.tip.key, d.tip.params)}</p>}
        </div>
      </div>
      {d.saferDetour && <button className="btn btn-primary mt-3 h-[52px] w-full" data-testid="take-detour" onClick={() => takeDetour(d.saferDetour!.routeId)}>{t("journey.detourBtn", { n: d.saferDetour.extraMinutes })}</button>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button className="btn h-12" onClick={() => void share()}>{t("journey.shareMine")}</button>
        <button className="btn btn-ghost h-12" data-testid="im-fine" onClick={dismissCard}>{t("journey.fine")}</button>
      </div>
    </motion.div>
  );
}
