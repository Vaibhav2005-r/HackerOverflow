import { useState } from "react";
import { ArrowLeft, PhoneCall } from "lucide-react";
import { useFakeCall } from "../store/fakeCall";
import { useNow } from "../lib/useNow";
import { navigate } from "../lib/router";
import { useT } from "../i18n";

const DELAYS = [[0, "fake.now"], [10, "fake.10s"], [60, "fake.1m"], [300, "fake.5m"]] as const;

export default function FakeCall() {
  const t = useT();
  const { status, caller: current, dueAt, schedule, end } = useFakeCall();
  const [caller, setCaller] = useState(current || "Maa");
  const [delay, setDelay] = useState<number>(10);
  const now = useNow(500);
  const left = Math.max(0, Math.ceil((dueAt - Date.now()) / 1000));
  void now;
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-bg-0 px-5 safe-top safe-bottom" data-testid="fake-call-setup">
      <div className="flex items-center gap-2 py-2"><button className="btn !min-h-11" onClick={() => navigate("/")} aria-label={t("common.back")}><ArrowLeft size={20} /></button><h1 className="text-xl font-bold">{t("fake.title")}</h1></div>
      <label className="mt-6 text-sm font-semibold" htmlFor="caller">{t("fake.caller")}</label>
      <input id="caller" className="field mt-1" data-testid="fake-caller-input" value={caller} maxLength={30} onChange={(e) => setCaller(e.target.value)} />
      <p className="mb-2 mt-6 text-sm font-semibold">{t("fake.delay")}</p>
      <div className="grid grid-cols-4 gap-2" role="group">
        {DELAYS.map(([s, k]) => <button key={s} className={`btn ${delay === s ? "btn-primary" : ""}`} aria-pressed={delay === s} data-testid={`delay-${s}`} onClick={() => setDelay(s)}>{t(k)}</button>)}
      </div>
      <button className="btn btn-primary btn-lg mt-8" data-testid="fake-schedule" onClick={() => { schedule(caller.trim() || "Maa", delay); if (delay > 0) navigate("/"); }}><PhoneCall />{t("fake.schedule")}</button>
      {status === "scheduled" && (
        <div className="card mt-4 flex items-center justify-between p-4" role="status" data-testid="fake-scheduled">
          <span>{t("fake.scheduled", { n: `${left}s` })}</span><button className="btn !min-h-10" onClick={end}>{t("common.cancel")}</button>
        </div>
      )}
    </div>
  );
}
