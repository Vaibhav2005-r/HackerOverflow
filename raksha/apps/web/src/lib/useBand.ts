import { useEffect, useState } from "react";
import { bandForDate, type Band } from "@raksha/core";

/** Effective band: the demo override, or the real clock (re-checked every minute). */
export function useBand(demo: "auto" | Band): Band {
  const [real, setReal] = useState<Band>(() => bandForDate(new Date()));
  useEffect(() => { const i = setInterval(() => setReal(bandForDate(new Date())), 60_000); return () => clearInterval(i); }, []);
  return demo === "auto" ? real : demo;
}
