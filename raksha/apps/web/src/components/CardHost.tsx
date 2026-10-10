import { AnimatePresence, m as motion } from "motion/react";
import { Phone } from "lucide-react";
import { telLink, EMERGENCY } from "@raksha/core";
import { dismissCard, ensureLiveShare, useJourney, userOk } from "../store/journey";
import { useSettings } from "../store/settings";
import { useNow } from "../lib/useNow";
import { shareText } from "../lib/share";
import { useT } from "../i18n";

/** Floating cards that can appear on any screen: check-in and the share prompt. */
export function CardHost() {
  const t = useT();
  const card = useJourney((s) => s.card);
  const name = useSettings((s) => s.name);
  const now = useNow(250);
  let body: React.ReactNode = null;
  if (card?.name === "check_in") {
    const d = card.data as { reason: "stopped" | "offroute" | "timer"; deadlineT: number };
    body = (
      <div data-testid="card-check-in" role="alertdialog" aria-live="assertive">
        <p className="text-[22px] font-bold leading-7">{t("checkin.title")}</p>
        <p className="text-sm text-text-2">{t(`checkin.${d.reason}`)} · {t("checkin.in", { n: Math.max(0, Math.ceil((d.deadlineT - now) / 1000)) })}</p>
        <button className="btn btn-primary btn-lg mt-3 w-full" data-testid="check-in-ok" onClick={userOk}>{t("checkin.ok")}</button>
        <a className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold" style={{ color: "var(--cls-extra-care)" }} href={telLink(EMERGENCY.police)}><Phone size={16} />112</a>
      </div>
    );
  } else if (card?.name === "share_prompt") {
    body = (
      <div data-testid="card-share-prompt">
        <p className="font-semibold">{t("share.prompt")}</p>
        <button className="btn btn-primary btn-lg mt-3 w-full" onClick={() => { void (async () => { const s = await ensureLiveShare(); if (s) await shareText(t("sos.shareText", { name: name || "I" }), s.url); })(); dismissCard(); }}>{t("journey.share")}</button>
      </div>
    );
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto max-w-md px-4 safe-top">
      <AnimatePresence>
        {body && (
          <motion.div key={card!.n} initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 32 }}
            className="pointer-events-auto mt-12 rounded-[20px] bg-surface-1 p-4" style={{ boxShadow: "0 0 0 1.5px var(--cls-extra-care), 0 0 32px rgba(255,122,107,.2)" }}>{body}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
