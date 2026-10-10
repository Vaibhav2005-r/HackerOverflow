import { useState } from "react";
import { AnimatePresence, m as motion } from "motion/react";
import type { PinHash } from "@raksha/core";
import { CompanionOrb } from "../components/CompanionOrb";
import { PinSetup } from "../components/PinSetup";
import { useSettings } from "../store/settings";
import { useSession } from "../store/session";
import { requestMotionPermission } from "../device/motion";
import { requestLocationOnce } from "../device/geolocation";
import { startLocation } from "../store/journey";
import { navigate } from "../lib/router";
import { useT } from "../i18n";
import { normalizePhone, PHONE_RE } from "../lib/phone";

const STEPS = ["s1", "s2", "s3", "name", "circle", "pin", "perm", "ready"] as const;
type Step = (typeof STEPS)[number];

export default function Onboarding() {
  const t = useT();
  const set = useSettings((s) => s.set);
  const settingsName = useSettings((s) => s.name);
  const { circle, save } = useSession();
  const [i, setI] = useState(0);
  const [name, setName] = useState(settingsName);
  const [c, setC] = useState({ name: "", phone: "", relation: "" });
  const [cErr, setCErr] = useState("");
  const [busy, setBusy] = useState(false);
  const step: Step = STEPS[i]!;
  const next = () => setI((x) => Math.min(STEPS.length - 1, x + 1));
  const back = () => setI((x) => Math.max(0, x - 1));

  const addContact = async () => {
    const phone = normalizePhone(c.phone);
    if (!c.name.trim() || !PHONE_RE.test(phone)) { setCErr(t("circle.invalidPhone")); return; }
    setCErr("");
    await save({ name: c.name.trim(), phone, relation: c.relation.trim() || undefined });
    setC({ name: "", phone: "", relation: "" });
  };
  const grant = async () => {
    setBusy(true);
    const ok = await requestLocationOnce();
    await requestMotionPermission();
    if (ok) startLocation();
    setBusy(false); next();
  };
  const finish = () => { set({ onboarded: true, name: name.trim() || "friend" }); navigate("/", true); };
  const story = { s1: ["ob.s1.title", "ob.s1.body"], s2: ["ob.s2.title", "ob.s2.body"], s3: ["ob.s3.title", "ob.s3.body"] } as const;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-bg-0 px-6 safe-top safe-bottom" data-testid="onboarding">
      <div className="flex items-center justify-between py-2">
        <button className="btn !min-h-11" onClick={back} disabled={i === 0} aria-label={t("common.back")}>←</button>
        <div className="flex gap-1.5" aria-hidden>{STEPS.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-brand" : "w-1.5 bg-text-1/20"}`} />)}</div>
        <span className="w-11" />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22 }} className="flex flex-1 flex-col justify-center py-4">
          {(step === "s1" || step === "s2" || step === "s3") && (
            <div className="text-center">
              <div className="mb-8 flex justify-center"><CompanionOrb size={step === "s1" ? 120 : 96} state={step === "s1" ? "idle" : step === "s2" ? "headsUp" : "guard"} /></div>
              <h1 className="text-3xl font-extrabold">{t(story[step][0])}</h1>
              <p className="mx-auto mt-3 max-w-xs text-lg text-text-2">{t(story[step][1])}</p>
              {step === "s1" && <p className="mx-auto mt-6 max-w-xs text-xs text-text-2">{t("disclaimer")}</p>}
            </div>
          )}
          {step === "name" && (
            <div>
              <h2 className="text-2xl font-bold">{t("ob.name.title")}</h2>
              <input className="field mt-6" data-testid="ob-name" placeholder={t("ob.name.ph")} value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          {step === "circle" && (
            <div>
              <h2 className="text-2xl font-bold">{t("ob.circle.title")}</h2>
              <p className="mb-4 mt-1 text-text-2">{t("ob.circle.body")}</p>
              {circle.map((p) => <div key={p.id} className="card mb-2 flex items-center justify-between p-3" data-testid="circle-item"><span className="font-semibold">{p.name}</span><span className="text-sm text-text-2">{p.phone}</span></div>)}
              {circle.length < 5 && (
                <div className="space-y-2">
                  <input className="field" data-testid="ob-contact-name" placeholder={t("circle.name")} value={c.name} maxLength={40} onChange={(e) => setC({ ...c, name: e.target.value })} />
                  <input className="field" data-testid="ob-contact-phone" inputMode="tel" placeholder={t("circle.phone")} value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
                  <input className="field" placeholder={t("circle.relation")} value={c.relation} maxLength={20} onChange={(e) => setC({ ...c, relation: e.target.value })} />
                  <p className="h-5 text-sm text-extra-care" role="alert">{cErr}</p>
                  <button className="btn w-full" data-testid="ob-add-contact" onClick={() => void addContact()}>{t("circle.add")}</button>
                </div>
              )}
            </div>
          )}
          {step === "pin" && <PinSetup onDone={(pin: PinHash, duress: PinHash) => { set({ pin, duress }); next(); }} />}
          {step === "perm" && (
            <div className="text-center">
              <h2 className="text-2xl font-bold">{t("ob.perm.title")}</h2>
              <p className="mx-auto mt-3 max-w-xs text-text-2">{t("ob.perm.body")}</p>
              <button className="btn btn-primary btn-lg mt-8 w-full" data-testid="ob-grant" disabled={busy} onClick={() => void grant()}>{t("ob.perm.grant")}</button>
              <button className="btn mt-3 w-full" onClick={next}>{t("ob.perm.later")}</button>
            </div>
          )}
          {step === "ready" && (
            <div className="text-center">
              <div className="mb-8 flex justify-center"><CompanionOrb size={110} /></div>
              <h2 className="text-3xl font-extrabold">{t("ob.ready.title")}</h2>
              <p className="mx-auto mt-3 max-w-xs text-text-2">{t("ob.ready.body")}</p>
              <p className="mx-auto mt-6 max-w-xs text-xs text-text-2">{t("disclaimer")}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {step !== "pin" && step !== "perm" && (
        <button className="btn btn-primary btn-lg mb-2 w-full" data-testid="ob-next" onClick={step === "ready" ? finish : next}>
          {step === "ready" ? t("common.start") : step === "circle" && circle.length === 0 ? t("common.skip") : t("common.next")}
        </button>
      )}
    </div>
  );
}
