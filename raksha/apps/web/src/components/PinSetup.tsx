import { useState } from "react";
import { hashPin, validatePinPair, type PinHash } from "@raksha/core";
import { PinPad } from "./PinPad";
import { useT } from "../i18n";

type Step = "pin" | "confirm" | "duress";

/** Two-PIN setup: normal PIN (entered twice) and a distinct duress PIN. Hashes are produced here and never leave the device. */
export function PinSetup({ onDone }: { onDone: (pin: PinHash, duress: PinHash) => void }) {
  const t = useT();
  const [step, setStep] = useState<Step>("pin");
  const [first, setFirst] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (pin: string) => {
    setErr("");
    if (step === "pin") { setFirst(pin); setStep("confirm"); }
    else if (step === "confirm") {
      if (pin !== first) { setErr(t("ob.pin.mismatch")); setStep("pin"); return; }
      setStep("duress");
    } else {
      if (validatePinPair(first, pin) !== "ok") { setErr(t("ob.duress.same")); return; }
      setBusy(true);
      onDone(await hashPin(first), await hashPin(pin));
    }
  };
  const title = step === "pin" ? t("ob.pin.title") : step === "confirm" ? t("ob.pin.confirm") : t("ob.duress.title");
  const body = step === "duress" ? t("ob.duress.body") : step === "pin" ? t("ob.pin.body") : "";
  return (
    <div data-testid={`pin-step-${step}`}>
      <PinPad key={`${step}-${err}`} title={title} sub={body} onSubmit={(p) => void submit(p)} error={err} disabled={busy} />
    </div>
  );
}
