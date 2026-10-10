export const PHONE_RE = /^\+?[0-9]{10,15}$/;
export const normalizePhone = (s: string) => s.replace(/[\s\-().]/g, "");
