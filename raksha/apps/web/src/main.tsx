import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/mukta/devanagari-400.css";
import "@fontsource/mukta/devanagari-500.css";
import "@fontsource/mukta/devanagari-600.css";
import "@fontsource/mukta/devanagari-700.css";
import "./styles/tokens.css";

// The contact view is a separate, lightweight chunk: no app shell, stores or onboarding.
const App = lazy(() => import("./app/App"));
const ShareView = lazy(() => import("./screens/ShareView"));

const m = location.pathname.match(/^\/s\/([0-9a-f]{16,128})\/?$/i);
createRoot(document.getElementById("root")!).render(
  <StrictMode><Suspense fallback={null}>{m ? <ShareView token={m[1]!} /> : <App />}</Suspense></StrictMode>,
);
