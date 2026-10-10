import { AnimatePresence, m as motion } from "motion/react";
import { CompanionOrb } from "./CompanionOrb";
import { useJourney, orbStateOf } from "../store/journey";
import type { OrbState } from "../store/mapUi";
import { useT } from "../i18n";

/** Glass card: orb (40) + Sakhi's line. aria-live=polite so screen readers hear her without focus moving. */
export function CompanionBar({ orb, idleKey = "sakhi.idle", text }: { orb?: OrbState; idleKey?: string; text?: string }) {
  const t = useT();
  const sakhi = useJourney((s) => s.sakhi);
  const derived = useJourney((s) => orbStateOf(s.engine));
  const line = text ?? (sakhi.text || t(idleKey));
  return (
    <div className="glass flex items-center gap-3 rounded-[20px] px-3.5 py-3" data-testid="sakhi-bar">
      <CompanionOrb state={orb ?? derived} size={40} />
      <div className="min-h-[44px] flex-1 content-center text-[15px] font-medium leading-[22px] [text-wrap:pretty]" aria-live="polite" role="status">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={text ?? sakhi.n} data-testid="sakhi-text" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }}>{line}</motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
