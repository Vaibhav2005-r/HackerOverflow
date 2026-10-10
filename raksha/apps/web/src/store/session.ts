import { create } from "zustand";
import { getBackend, type TrustedContact } from "../services/backend";

interface SessionState {
  userId?: string;
  circle: TrustedContact[];
  init: () => Promise<void>;
  save: (c: Omit<TrustedContact, "id"> & { id?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  circle: [],
  async init() {
    const b = getBackend();
    const { userId } = await b.signIn();
    set({ userId, circle: await b.getCircle() });
  },
  async save(c) { const b = getBackend(); await b.saveContact(c); set({ circle: await b.getCircle() }); },
  async remove(id) { const b = getBackend(); await b.deleteContact(id); set({ circle: await b.getCircle() }); },
}));
