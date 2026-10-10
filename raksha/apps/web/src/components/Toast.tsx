import { AnimatePresence, m as motion } from "motion/react";
import { Check } from "lucide-react";
import { useToast } from "../store/toast";

export function Toast() {
  const { msg, n } = useToast();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-[80] flex justify-center">
      <AnimatePresence>
        {msg && (
          <motion.div key={n} role="status" data-testid="toast" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2.5 text-sm font-semibold shadow-elev"><Check size={16} style={{ color: "var(--success)" }} />{msg}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
