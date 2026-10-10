import { create } from "zustand";

interface ToastState { msg: string; n: number }
export const useToast = create<ToastState>(() => ({ msg: "", n: 0 }));
let timer: ReturnType<typeof setTimeout> | undefined;
/** Pill toast, auto-dismissed after 2.6 s. */
export function toast(msg: string) {
  clearTimeout(timer);
  useToast.setState((s) => ({ msg, n: s.n + 1 }));
  timer = setTimeout(() => useToast.setState({ msg: "" }), 2600);
}
