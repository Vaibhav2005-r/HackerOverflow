import { useEffect } from "react";
import { LazyMotion } from "motion/react";
import MapView from "../map/MapView";
import { CardHost } from "../components/CardHost";
import { FakeCallOverlay } from "../components/FakeCallOverlay";
import Onboarding from "../screens/Onboarding";
import Home from "../screens/Home";
import Search from "../screens/Search";
import Countdown from "../screens/Countdown";
import Resolved from "../screens/Resolved";
import Arrived from "../screens/Arrived";
import { Toast } from "../components/Toast";
import Plan from "../screens/Plan";
import Journey from "../screens/Journey";
import Guard from "../screens/Guard";
import Sos from "../screens/Sos";
import FakeCall from "../screens/FakeCall";
import Circle from "../screens/Circle";
import Settings from "../screens/Settings";
import Legal from "../screens/Legal";
import Insights from "../screens/Insights";
import DevComponents from "../screens/DevComponents";
import { useSettings } from "../store/settings";
import { useSession } from "../store/session";
import { useCity } from "../store/city";
import { initRuntime, manualGuard, setSakhiLanguage, startLocation, useJourney } from "../store/journey";
import { navigate, usePath } from "../lib/router";
import { useMapUi } from "../store/mapUi";
import { useBand } from "../lib/useBand";

// dev/test hook so e2e can drive state that is awkward to reach through WebGL (e.g. tapping a hex)
if (import.meta.env.DEV) Object.assign(window, { __raksha: { mapUi: useMapUi, city: useCity, journey: useJourney, settings: useSettings } });

const MAP_SCREENS = ["/", "/plan", "/journey", "/guard", "/search"];
const OVERLAYS = ["/plan", "/journey", "/guard", "/sos", "/fake-call", "/circle", "/settings", "/search", "/privacy", "/terms", "/insights"];

const loadMotion = () => import("./motionFeatures").then((m) => m.default);

export default function App() {
  const path = usePath();
  const onboarded = useSettings((s) => s.onboarded);
  const band = useBand();
  const reduce = useSettings((s) => s.reduceMotion);
  const phase = useJourney((s) => s.engine.phase);
  const resolvedOpen = useJourney((s) => s.resolvedOpen);
  const arrived = useJourney((s) => s.arrived);
  const hasPlan = useJourney((s) => !!s.plan);

  useEffect(() => { document.documentElement.dataset.theme = band === "day" ? "day" : "night"; }, [band]);
  const lang = useSettings((s) => s.lang);
  useEffect(() => { document.documentElement.dataset.reduceMotion = String(reduce); }, [reduce]);
  useEffect(() => { document.documentElement.lang = lang; setSakhiLanguage(lang); }, [lang]);
  useEffect(() => { void useSession.getState().init(); void useCity.getState().init(); initRuntime(); }, []);
  useEffect(() => {
    if (!onboarded) return;
    startLocation();
    if (new URLSearchParams(location.search).get("guard") === "1") { history.replaceState(null, "", "/"); manualGuard(true); } // PWA shortcut "Guard me now"
  }, [onboarded]);
  useEffect(() => {
    if (path === "/dev/components" || path === "/privacy" || path === "/terms") return;   // readable before onboarding too
    if (!onboarded && path !== "/onboarding") navigate("/onboarding", true);
    else if (onboarded && path === "/onboarding") navigate("/", true);
  }, [path, onboarded]);
  // Journey state lives in memory: after a reload, orphaned screens fall back to Home instead of rendering blank
  useEffect(() => {
    if (!onboarded || phase !== "IDLE") return;
    if ((path === "/plan" && !hasPlan) || path === "/journey" || path === "/guard") navigate("/", true);
  }, [path, onboarded, phase, hasPlan]);

  if (path === "/dev/components") return <LazyMotion features={loadMotion}><DevComponents /></LazyMotion>;
  if (!onboarded && (path === "/privacy" || path === "/terms")) return <Legal kind={path === "/privacy" ? "privacy" : "terms"} />;
  if (!onboarded) return <LazyMotion features={loadMotion}><Onboarding /></LazyMotion>;

  return (
    <LazyMotion features={loadMotion}>
    <div className="relative h-full overflow-hidden bg-bg-0 text-text-1">
      <MapView hidden={!MAP_SCREENS.includes(path)} />
      {path === "/plan" && <Plan />}
      {path === "/journey" && <Journey />}
      {path === "/guard" && <Guard />}
      {path === "/search" && <Search />}
      {!OVERLAYS.includes(path) && <Home />}
      {path === "/sos" && <Sos />}
      {path === "/fake-call" && <FakeCall />}
      {path === "/circle" && <Circle />}
      {path === "/settings" && <Settings />}
      {path === "/insights" && <Insights />}
      {path === "/privacy" && <Legal kind="privacy" />}
      {path === "/terms" && <Legal kind="terms" />}
      <CardHost />
      {phase === "SOS_COUNTDOWN" && <Countdown />}
      {resolvedOpen && <Resolved />}
      {arrived && !resolvedOpen && phase !== "SOS_COUNTDOWN" && <Arrived />}
      <FakeCallOverlay />
      <Toast />
    </div>
    </LazyMotion>
  );
}
