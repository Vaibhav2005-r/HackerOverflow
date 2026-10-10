import { useEffect, useState } from "react";
import { bandForDate, type Band } from "@raksha/core";
import { useSettings } from "../store/settings";

/** The band in effect: the real clock, re-checked every minute (or the pretend band, but only in Test mode). */
export function useBand(): Band {
  const testMode = useSettings((s) => s.testMode);
  const pretend = useSettings((s) => s.demoBand);
  const [real, setReal] = useState<Band>(() => bandForDate(new Date()));
  useEffect(() => { const i = setInterval(() => setReal(bandForDate(new Date())), 60_000); return () => clearInterval(i); }, []);
  return testMode && pretend !== "auto" ? pretend : real;
}
