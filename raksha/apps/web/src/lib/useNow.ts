import { useEffect, useState } from "react";
import { clock } from "./clock";
/** Re-renders every `ms` with the virtual clock's time. */
export function useNow(ms = 1000) {
  const [n, setN] = useState(() => clock.now());
  useEffect(() => { const i = setInterval(() => setN(clock.now()), ms); return () => clearInterval(i); }, [ms]);
  return n;
}
