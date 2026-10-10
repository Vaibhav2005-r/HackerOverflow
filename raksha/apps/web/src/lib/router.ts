import { useSyncExternalStore } from "react";

const EVT = "raksha:nav";
export function navigate(path: string, replace = false) {
  if (location.pathname === path) return;
  (replace ? history.replaceState : history.pushState).call(history, null, "", path);
  window.dispatchEvent(new Event(EVT));
}
const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb); window.addEventListener("popstate", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("popstate", cb); };
};
export const usePath = () => useSyncExternalStore(subscribe, () => location.pathname);
