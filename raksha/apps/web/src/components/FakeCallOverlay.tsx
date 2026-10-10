import { AnimatePresence, m as motion } from "motion/react";
import { Phone, PhoneOff, User } from "lucide-react";
import { useFakeCall } from "../store/fakeCall";
import { useNow } from "../lib/useNow";
import { useT } from "../i18n";

/** Full-screen incoming / in-call UI. Mounted globally so a scheduled call can ring on any screen. */
export function FakeCallOverlay() {
  const t = useT();
  const { status, caller, answeredAt, answer, end } = useFakeCall();
  const now = useNow(500);
  const secs = Math.max(0, Math.floor((Date.now() - answeredAt) / 1000));
  void now;
  const open = status === "ringing" || status === "active";
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="fake" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 200, damping: 26 }}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-gradient-to-b from-slate-800 to-black px-8 py-16 text-white" data-testid="fake-call-screen" role="dialog" aria-label={t("fake.title")}>
          <div className="text-center">
            <p className="text-sm text-white/60">{status === "ringing" ? t("fake.incoming") : t("fake.mobile")}</p>
            <h2 className="mt-2 text-4xl font-semibold" data-testid="fake-caller">{caller}</h2>
            <p className="mt-2 tabular-nums text-white/70" data-testid="fake-timer">{status === "active" ? `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}` : t("fake.mobile")}</p>
          </div>
          <div className="grid size-32 place-items-center rounded-full bg-white/10"><User size={64} /></div>
          {status === "ringing" ? (
            <div className="flex w-full max-w-xs justify-between">
              <button className="grid size-20 place-items-center rounded-full bg-red-500" onClick={end} aria-label={t("fake.decline")} data-testid="fake-decline"><PhoneOff size={32} /></button>
              <button className="grid size-20 animate-pulse place-items-center rounded-full bg-green-500" onClick={answer} aria-label={t("fake.answer")} data-testid="fake-answer"><Phone size={32} /></button>
            </div>
          ) : (
            <button className="grid size-20 place-items-center rounded-full bg-red-500" onClick={end} aria-label={t("fake.end")} data-testid="fake-end"><PhoneOff size={32} /></button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
