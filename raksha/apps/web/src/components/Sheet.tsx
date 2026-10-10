import { lazy, Suspense, useRef, type ReactNode } from "react";

const Impl = lazy(() => import("./SheetImpl"));

/** Bottom sheet. vaul/radix load on first open (~15 KB gzip off the initial bundle) and stay mounted for the exit animation. */
export function Sheet(props: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  const opened = useRef(false);
  if (props.open) opened.current = true;
  if (!opened.current) return null;
  return <Suspense fallback={null}><Impl {...props} /></Suspense>;
}
